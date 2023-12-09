---
title: "Building a Stateless, Containerized Trivia API in Golang"
publishedAt: 2023-12-09
description: "Follow along as I build a stateless trivia API in Go and containerize it with Docker."
slug: "stateless-containerized-trivia-api-go"
isPublish: true
---

Building a Stateless, Containerized Trivia API in Golang
---
While working on a much larger project, I decided it would be a good idea to make something smaller that could show off how much I have improved my development strategies and back end knowledge since the days of my first full stack project, Massflip. Today, I will be walking you through my process of creating a trivia API that will allow people to get random trivia questions and then check their answers for correctness. Since this is supposed to be a stateless system, there should be no writing to a database when getting trivia questions or verifying answers. In fact, we won't have any database at all, other than however we choose to store our trivia questions (for this project, our questions will be stored in a json file that gets loaded into memory, but you could modify it to use an SQL database or similar).

Now since I don't really know anything about trivia terminology, let's go over the terms I have decided to use when referring to our objects.

- A "Question" is a trivia question as it is represented in memory/our DB i.e. includes the answer.
- A "Trivia" is a trivia question that gets sent to the player for them to guess the answer, and
- "Questions" represents our whole array of categorized trivia questions stored in memory/in our DB.

## An API is a Contract

An API is a contract that defines the interaction between a client and server. So to begin developing the API, we need to first define the terms of the contract we are creating. Our trivia server will have two endpoints:

- GET /trivia: Fetches a trivia question, and
- GET /guess: Fetches whether a guess is correct or not.

The server must not store any question state in between request calls, so we will need to generate an ID that will be a reference to the question we are making a guess for. Because we need the ID to make a guess, we will also need to return that ID when we are getting the trivia question from the /trivia endpoint. Since we are already defining some specifics about request and response parameters, let's go ahead and define the specification for our API.

| Method | Endpoint | Accepts                                               | Request                              | Response                                                                                                                                                                 |
|--------|----------|-------------------------------------------------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GET    | /trivia  | application/json<br>application/x-www-form-urlencoded | category: string (optional)          | application/json<br>question_id: string<br>question: string<br>category: string<br>format: MultipleChoice\|TrueFalse<br>choices: [string]string IF format=MultipleChoice |
| GET    | /guess   | application/json<br>application/x-www-form-urlencoded | question_id: string<br>guess: string | application/json<br>question_id: string<br>correct: boolean                                                                                                              |

You may notice that this specification only includes the OK paths and doesn't include any error responses. We will get to those later. Now that we have designed the contract that our API must follow, we can begin to enforce the contract using unit tests.

## Bottom-Up Development

This project will follow a bottom-up development structure. In this structure, we will first develop the components (in Go, modules) of our application then combine them in higher layers to form our completed application. The structure of our program will look like this:

Main -> Server -> Trivia

top ------------> bottom

The trivia module will define the way we store and retrieve trivia questions, as well as any other "database" functions we may need, the server module will define our server structure and endpoint handlers, and the main module will tell our server to begin listening for http requests.

## The Trivia Module

Just the same as we created a specification for our server as a whole, we need to also create a specification for the public functions in the modules we create. Creating this contract and enforcing it using tests is essential for ensuring our application is clearly structured and easily readable. This step is even more important when creating modules that you intend to reuse in other projects or to be publicly available.

Our Trivia Module will define a type Questions, which will hold all of our trivia questions in memory. This is essentially our database. On that type, we will define two publicly available methods: 

`Questions.GetRandomQuestion(string) -> Question`
and
`Questions.GetQuestionById(string) -> Question`

We will enforce their behavior by writing tests. Let's begin to finally write some code. First, we create our go module for the whole project, then create our submodule directory and files for our Questions type.

```
$ go mod init github.com/gabehf/trivia-api
$ mkdir trivia
$ touch trivia/questions.go trivia/questions_test.go
```

In order to write our Questions structure's methods, we need to define the data that will be contained within it. 

```go
// questions.go
package trivia

import "sync"

// represents the structure of trivia questions stored
// in the trivia.json file
type Question struct {
	Question string   `json:"question"`
	Category string   `json:"category"`
	Format   string   `json:"format"`
	Choices  []string `json:"choices"`
	Answer   string   `json:"answer"`
}

type Questions struct {
	Categories []string
	M          map[string][]*Question
	lock       *sync.RWMutex
}

func (q *Questions) Init() {
	q.lock = &sync.RWMutex{}
}

// Gets a random question and its index from the category, if specified.
func (q *Questions) GetRandomQuestion(category string) (*Question, int) {
	return nil, 0
}

func (q *Questions) GetQuestionById(id string) *Question {
	return nil
}
```

You may notice here that I have chosen to include a `sync.RWMutex` as part of our Questions struct to ensure it is concurrency safe, even though concurrent reads from a map are already concurrency safe in Go. I included the mutex because in the future I plan to allow for reloading the trivia question list while the server is still running. Now that we have our database representation, we can fill in some test data and write the tests to enforce the contract of the trivia module's API. We will add the test data in a `TestMain` for the trivia package.

```bash
$ touch trivia/trivia_main_test.go
```
---

```go
// trivia_main_test.go
package trivia_test

var Q trivia.Questions
var expect *trivia.Question

func TestMain(m *testing.M) {
	Q.Init()
	Q.Categories = []string{"world history"}
	Q.M = map[string][]trivia.Question{
		"world history": {
			{
				Question: "The ancient city of Rome was built on how many hills?",
				Format:   "MultipleChoice",
				Category: "World History",
				Choices: []string{
					"Eight",
					"Four",
					"Nine",
					"Seven",
				},
				Answer: "Seven",
			},
		},
	}
expect = &trivia.Question{
		Question: "The ancient city of Rome was built on how many hills?",
		Category: "World History",
		Format:   "MultipleChoice",
		Choices: []string{
			"Eight",
			"Four",
			"Nine",
			"Seven",
		},
		Answer: "Seven",
	}
	m.Run()
}
```
---

```go
// questions_test.go
package trivia_test

import (
	"reflect"
	"testing"

	"github.com/gabehf/trivia-api/trivia"
)

func TestGetRandomQuestion(t *testing.T) {
	// on OK path, GetTrivia must return the question in our test data
	tq, _ := Q.GetRandomQuestion("world history")
	if tq == nil {
		t.Fatal("trivia question must not be nil")
	}
	if !reflect.DeepEqual(tq, expect) {
		t.Errorf("returned question does not match expectation, got %v", tq)
	}

	// with no category specified, GetTrivia must pick a random category and fetch a question
	// with only one question in our test data, it is the same question from before
	tq, _ = Q.GetRandomQuestion("")
	if tq == nil {
		t.Fatal("trivia question must not be nil")
	}
	if !reflect.DeepEqual(tq, expect) {
		t.Errorf("returned question does not match expectation, got %v", tq)
	}

	// on FAIL path, GetTrivia must return nil to indicate no questions are found
	tq, _ = Q.GetRandomQuestion("Geography")
	if tq != nil {
		t.Errorf("expected nil, got %v", tq)
	}
}

func TestGetQuestionById(t *testing.T) {
	// on OK path, GetTrivia must return the question in our test data
	tq := Q.GetQuestionById("world History|0")
	if tq == nil {
		t.Fatal("trivia question must not be nil")
	}
	if !reflect.DeepEqual(tq, expect) {
		t.Errorf("returned question does not match expectation, got %v", tq)
	}

	// FAIL path: malformed id
	tq = Q.GetQuestionById("hey")
	if tq != nil {
		t.Errorf("expected nil, got %v", tq)
	}
	// FAIL path: invalid category
	tq = Q.GetQuestionById("hey|0")
	if tq != nil {
		t.Errorf("expected nil, got %v", tq)
	}
	// FAIL path: invalid index
	tq = Q.GetQuestionById("world history|9")
	if tq != nil {
		t.Errorf("expected nil, got %v", tq)
	}
}
```

If we run `go test ./...` you will see that our tests are working and reporting a lot of failures since we have not implemented our methods yet. So let's go ahead and fill in the logic for those methods. 

```go
// questions.go
package trivia

import (
	"math/rand"
	"strconv"
	"strings"
	"sync"
)
...
func (q *Questions) categoryExists(cat string) bool {
	q.lock.RLock()
	defer q.lock.RUnlock()
	cat = strings.ToLower(cat)
	if q.M[cat] == nil || len(q.M[cat]) < 1 {
		return false
	}
	return true
}

func (q *Questions) getRandomCategory() string {
	q.lock.RLock()
	defer q.lock.RUnlock()
	return q.Categories[rand.Int()%len(q.Categories)]
}

// Gets a random question from the category, if specified.
func (q *Questions) GetRandomQuestion(category string) (*Question, int) {
	q.lock.RLock()
	defer q.lock.RUnlock()
	// NOTE: it is okay to call another function that locks the RWMutex here,
	// as it will not cause a deadlock since CategoryExists only locks the Read
	if category == "" {
		category = q.getRandomCategory()
	} else if !q.categoryExists(category) {
		return nil, 0
	}
	category = strings.ToLower(category)
	qIndex := rand.Int() % len(q.M[category])
	return &q.M[category][qIndex], qIndex
}

func (q *Questions) GetQuestionById(id string) *Question {
	// get values from question_id
	questionSlice := strings.Split(id, "|")
	if len(questionSlice) != 2 {
		return nil
	}
	category, indexS := questionSlice[0], questionSlice[1]
	category = strings.ToLower(category)
	index, err := strconv.Atoi(indexS)
	if err != nil {
		return nil
	}

	q.lock.RLock()
	defer q.lock.RUnlock()
	// ensure category exists
	if !q.categoryExists(category) {
		return nil
	}
	// ensure question index is valid
	if len(q.M[category]) <= index {
		return nil
	}

	// retrieve question
	return &q.M[category][index]
}
```

I've skipped some refactoring steps for the sake of brevity, but you will notice that along with our two public functions I've also included some helper functions to separate some of the reusable logic. Now, let's go back and run our tests.

```bash
$ go test ./...
ok      github.com/gabehf/trivia-api/trivia     0.002s
```

## The Server Module

The server module is the next higher level in our bottom-up design. This module will use the structure and methods from the trivia module in the server endpoints. A server architecture I like to use in my programs is creating a server structure that holds the router and database, with methods that serve as endpoint handlers. Let's first create our server structure:

```bash
$ mkdir server
$ touch server/server.go
```
---
```go
// server.go
package server

import (
	"github.com/gabehf/trivia-api/trivia"
	"github.com/labstack/echo/v4"
)

type Server struct {
	Q *trivia.Questions
}

func (s *Server) Init() {
	s.Q = new(trivia.Questions)
	s.Q.Init()
}

func Run() error {
	e := echo.New()
	return e.Start(":3000")
}
```

Go ahead and `go get` any packages you may need, such as `labstack/echo`. Now, we can declare our two handlers.

```go
// get_trivia.go
package server

type GetTriviaResponse struct {
	QuestionId string            `json:"question_id"`
	Question   string            `json:"question"`
	Category   string            `json:"category"`
	Format     string            `json:"format"`
	Choices    map[string]string `json:"choices,omitempty"`
}

func (s *Server) GetTrivia(e echo.Context) error {
	return errors.New("not implemented")
}
```
---
```go
// get_guess.go
package server

func (s *Server) GetGuess(e echo.Context) error {
	return errors.New("not implemented")
}
```

I prefer to put handlers into their own files with the naming convention `<method>_<path>.go` . I am using LabStack's echo router in this application, so the function signature for our handlers is `function(echo.Context) error` . Now let's define our tests for both of these handlers in their respective test files. I will be following echo's method for creating handler tests.

To start testing our handlers, let's create our TestMain for our server package.

```go
// server_main_test.go
package server_test

import (
	"testing"

	"github.com/gabehf/trivia-api/server"
	"github.com/gabehf/trivia-api/trivia"
)

var S *server.Server

func TestMain(m *testing.M) {
	S = new(server.Server)
	S.Init()
	S.Q.Init()
	S.Q.Categories = []string{"world history"}
	S.Q.M = map[string][]trivia.Question{
		"world history": {
			{
				Question: "The ancient city of Rome was built on how many hills?",
				Format:   "MultipleChoice",
				Category: "World History",
				Choices: []string{
					"Eight",
					"Four",
					"Nine",
					"Seven",
				},
				Answer: "Seven",
			},
		},
	}
	m.Run()
}
```

And then we define our tests for each of our two handlers.

```go
// get_trivia_test.go
package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gabehf/trivia-api/server"
	"github.com/labstack/echo/v4"
)

func TestTriviaHandler(t *testing.T) {
	jsonBody := []byte("{\"category\":\"World History\"}")

	expect := server.GetTriviaResponse{
		Question: "The ancient city of Rome was built on how many hills?",
		Format:   "MultipleChoice",
		Category: "World History",
	}

	// OK path: json body
	e := echo.New()
	req := httptest.NewRequest("GET", "/trivia", bytes.NewReader(jsonBody))
	req.Header["Content-Type"] = []string{"application/json"}
	res := httptest.NewRecorder()
	c := e.NewContext(req, res)
	err := S.GetTrivia(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", res.Code)
	}

	result := new(server.GetTriviaResponse)
	err = json.Unmarshal(res.Body.Bytes(), result)
	if err != nil {
		t.Error("malformed json response")
	}
	if result.Question != expect.Question {
		t.Errorf("expected question '%s', got '%s'", expect.Question, result.Question)
	}
	if result.Format != expect.Format {
		t.Errorf("expected format %s, got %s", expect.Format, result.Format)
	}
	if !strings.EqualFold(expect.Category, result.Category) {
		t.Errorf("expected category %s, got %s", expect.Category, result.Category)
	}

	// OK path: urlencoded body
	e = echo.New()
	req = httptest.NewRequest("GET", "/trivia?category=World+History", nil)
	req.Header["Content-Type"] = []string{"application/x-www-form-urlencoded"}
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetTrivia(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", res.Code)
	}
	expect = server.GetTriviaResponse{
		Question: "The ancient city of Rome was built on how many hills?",
		Format:   "MultipleChoice",
		Category: "World History",
	}
	result = new(server.GetTriviaResponse)
	err = json.Unmarshal(res.Body.Bytes(), result)
	if err != nil {
		t.Error("malformed json response")
	}
	if result.Question != expect.Question {
		t.Errorf("expected question '%s', got '%s'", expect.Question, result.Question)
	}
	if result.Format != expect.Format {
		t.Errorf("expected format %s, got %s", expect.Format, result.Format)
	}
	if !strings.EqualFold(expect.Category, result.Category) {
		t.Errorf("expected category %s, got %s", expect.Category, result.Category)
	}

	// OK path: no body (random category)
	e = echo.New()
	req = httptest.NewRequest("GET", "/trivia", nil)
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetTrivia(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", res.Code)
	}
	expect = server.GetTriviaResponse{
		Question: "The ancient city of Rome was built on how many hills?",
		Format:   "MultipleChoice",
		Category: "World History",
	}
	result = new(server.GetTriviaResponse)
	err = json.Unmarshal(res.Body.Bytes(), result)
	if err != nil {
		t.Error("malformed json response")
	}
	if result.Question != expect.Question {
		t.Errorf("expected question '%s', got '%s'", expect.Question, result.Question)
	}
	if result.Format != expect.Format {
		t.Errorf("expected format %s, got %s", expect.Format, result.Format)
	}
	if !strings.EqualFold(expect.Category, result.Category) {
		t.Errorf("expected category %s, got %s", expect.Category, result.Category)
	}
}
```
---
```go
// get_guess_test.go
package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gabehf/trivia-api/server"
	"github.com/labstack/echo/v4"
)

func TestGuessHandler(t *testing.T) {
	jsonBody := []byte("{\"question_id\":\"World History|0\",\"guess\":\"seven\"}")

	// OK path: json body
	e := echo.New()
	req := httptest.NewRequest("GET", "/guess", bytes.NewReader(jsonBody))
	req.Header["Content-Type"] = []string{"application/json"}
	res := httptest.NewRecorder()
	c := e.NewContext(req, res)
	err := S.GetGuess(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", res.Code)
	}

	result := new(server.GetGuessResponse)
	err = json.Unmarshal(res.Body.Bytes(), result)
	if err != nil {
		t.Error("malformed json response")
	}
	if result.QuestionId != "World History|0" {
		t.Errorf("expected question_id 'World History|0', got '%s'", result.QuestionId)
	}
	if result.Correct != true {
		t.Errorf("expected correct to be true, got false")
	}

	// OK path: urlencoded body
	e = echo.New()
	req = httptest.NewRequest("GET", "/guess?question_id=World+History%7C0&guess=Seven", nil)
	req.Header["Content-Type"] = []string{"application/x-www-form-urlencoded"}
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetGuess(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", res.Code)
	}

	result = new(server.GetGuessResponse)
	err = json.Unmarshal(res.Body.Bytes(), result)
	if err != nil {
		t.Error("malformed json response")
	}
	if result.QuestionId != "World History|0" {
		t.Errorf("expected question_id 'World History|0', got '%s'", result.QuestionId)
	}
	if result.Correct != true {
		t.Errorf("expected correct to be true, got false")
	}
}
```

Similar to when we defined our applications API specification at the beginning of this post, we are only testing the OK paths. We will add the FAIL paths later when I go over how we will be handling errors in our endpoints. Once again, running `go test ./...` here will generate a ton of errors since we have yet to implement our handlers.

Now that we have our applications API contract enforced with tests, we can implement our handlers.

```go
// get_trivia.go
package server

import (
	"math/rand"
	"strconv"

	"github.com/labstack/echo/v4"
)

type GetTriviaRequest struct {
	Category string `json:"category" query:"category"`
}
type GetTriviaResponse struct {
	QuestionId string            `json:"question_id"`
	Question   string            `json:"question"`
	Category   string            `json:"category"`
	Format     string            `json:"format"`
	Choices    map[string]string `json:"choices,omitempty"`
}

func (s *Server) GetTrivia(e echo.Context) error {
	req := new(GetTriviaRequest)
	e.Bind(req)

	question, qIndex := s.Q.GetRandomQuestion(req.Category)
	if question == nil {
		return errors.New("unhandled error")
	}
	// randomly order answer choices if the format is multiple choice
	if question.Format == "MultipleChoice" && question.Choices != nil {
		rand.Shuffle(len(question.Choices), func(i, j int) {
			question.Choices[i], question.Choices[j] = question.Choices[j], question.Choices[i]
		})
		// enforce that multiple choice questions must have four choices
		// if not, there must be an error in our data somewhere that we need
		// to fix
		if len(question.Choices) != 4 {
			return errors.New("unhandled error")
		}
	}

	// build and return response
	tq := new(GetTriviaResponse)
	tq.QuestionId = question.Category + "|" + strconv.Itoa(qIndex)
	tq.Category = question.Category
	tq.Format = question.Format
	tq.Question = question.Question
	if tq.Format == "MultipleChoice" {
		tq.Choices = map[string]string{
			"A": question.Choices[0],
			"B": question.Choices[1],
			"C": question.Choices[2],
			"D": question.Choices[3],
		}
	}
	return e.JSONPretty(200, tq, "  ")
}
```
---

```go
// get_guess.go
package server

import (
	"strings"

	"github.com/labstack/echo/v4"
)

type GetGuessRequest struct {
	QuestionId string `json:"question_id" query:"question_id"`
	Guess      string `json:"guess" query:"guess"`
}
type GetGuessResponse struct {
	QuestionId string `json:"question_id"`
	Correct    bool   `json:"correct"`
}

func (s *Server) GetGuess(e echo.Context) error {
	req := new(GetGuessRequest)
	e.Bind(req)

	// ensure required parameters exist
	errs := make(map[string]string, 0)
	if req.Guess == "" {
		errs["guess"] = "required parameter missing"
	}
	if req.QuestionId == "" {
		errs["question_id"] = "required parameter missing"
	}
	if len(errs) > 0 {
		return errors.New("unhandled error")
	}

	question := s.Q.GetQuestionById(req.QuestionId)
	if question == nil {
		errs["question_id"] = "invalid or malformed"
		return errors.New("unhandled error")
	}

	// validate answer with case insensitive string compare
	correct := strings.EqualFold(question.Answer, req.Guess)

	return e.JSONPretty(200, &GetGuessResponse{req.QuestionId, correct}, "  ")
}
```

And let's run our tests to make sure the OK path is working.

```bash
$ go test ./...                                                                                                       1:57:33 AM
ok      github.com/gabehf/trivia-tmp/server     0.004s
ok      github.com/gabehf/trivia-tmp/trivia     (cached)
```

## Handle Errors and Failures With jSend

*Note: I would usually not wait until the end to handle errors in my API, but for the sake of clarity in organization* *in this post I have formatted it this way.*

When our handlers encounter an error - both from client error and server error - we need to inform the client so they can respond adequately. The format we will use to respond with errors is the jSend specification as defined in [this GitHub post](https://github.com/omniti-labs/jsend). Based on this specification, we can add FAIL paths(s) to our handler tests.

```go
// get_trivia_test.go
...
func TestTriviaHandler(t *testing.T) {
	...
	// FAIL path: invalid category
	e = echo.New()
	req = httptest.NewRequest("GET", "/trivia?category=70s+Music", nil)
	req.Header["Content-Type"] = []string{"application/x-www-form-urlencoded"}
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetTrivia(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusNotFound {
		t.Errorf("expected status 404 Not Found, got %d", res.Code)
	}
	errResult := struct {
		Error bool
		Data  map[string]string
	}{}
	err = json.Unmarshal(res.Body.Bytes(), &errResult)
	if err != nil {
		t.Error("malformed json response")
	}
	if !errResult.Error {
		t.Error("expected error to be true, got false")
	}
	if errResult.Data["category"] == "" {
		t.Errorf("expected error information in data[category], got \"\"")
	}
}
```
---
```go
// get_guess_test.go
...
func TestGuessHandler(t *testing.T) {
	...
	// FAIL path: invalid question id
	e = echo.New()
	req = httptest.NewRequest("GET", "/guess?question_id=hey&guess=Seven", nil)
	req.Header["Content-Type"] = []string{"application/x-www-form-urlencoded"}
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetGuess(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusNotFound {
		t.Errorf("expected status 400 Bad Request, got %d", res.Code)
	}
	errResult := struct {
		Error bool
		Data  map[string]string
	}{}
	err = json.Unmarshal(res.Body.Bytes(), &errResult)
	if err != nil {
		t.Error("malformed json response")
	}
	if !errResult.Error {
		t.Error("expected error to be true, got false")
	}
	if errResult.Data["question_id"] == "" {
		t.Errorf("expected error information in data[question_id], got \"\"")
	}

	// FAIL path: missing params
	e = echo.New()
	req = httptest.NewRequest("GET", "/guess", nil)
	req.Header["Content-Type"] = []string{"application/x-www-form-urlencoded"}
	res = httptest.NewRecorder()
	c = e.NewContext(req, res)
	err = S.GetGuess(c)
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if res.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 Bad Request, got %d", res.Code)
	}
	errResult = struct {
		Error bool
		Data  map[string]string
	}{}
	err = json.Unmarshal(res.Body.Bytes(), &errResult)
	if err != nil {
		t.Error("malformed json response")
	}
	if !errResult.Error {
		t.Error("expected error to be true, got false")
	}
	if errResult.Data["question_id"] == "" {
		t.Errorf("expected error information in data[question_id], got \"\"")
	}
	if errResult.Data["guess"] == "" {
		t.Errorf("expected error information in data[guess], got \"\"")
	}
}
```

Running `go test ./...` now will show us just how many errors can go unnoticed without proper error handling and enforcement of fail behavior in our API.

```bash
$ go test ./...                                                                                                       1:58:38 AM
--- FAIL: TestGuessHandler (0.00s)
    get_guess_test.go:78: expected nil error, got unhandled error
    get_guess_test.go:81: expected status 400 Bad Request, got 200
    get_guess_test.go:89: malformed json response
    get_guess_test.go:92: expected error to be true, got false
    get_guess_test.go:95: expected error information in data[question_id], got ""
    get_guess_test.go:106: expected nil error, got unhandled error
    get_guess_test.go:109: expected status 400 Bad Request, got 200
    get_guess_test.go:117: malformed json response
    get_guess_test.go:120: expected error to be true, got false
    get_guess_test.go:123: expected error information in data[question_id], got ""
    get_guess_test.go:126: expected error information in data[guess], got ""
--- FAIL: TestTriviaHandler (0.00s)
    get_trivia_test.go:127: expected nil error, got unhandled error
    get_trivia_test.go:130: expected status 404 Not Found, got 200
    get_trivia_test.go:138: malformed json response
    get_trivia_test.go:141: expected error to be true, got false
    get_trivia_test.go:144: expected error information in data[category], got ""
FAIL
FAIL    github.com/gabehf/trivia-tmp/server     0.003s
ok      github.com/gabehf/trivia-tmp/trivia     (cached)
FAIL
```

 Now with the behavior enforced, we can extend our handlers to respond to errors correctly.

```go
// get_trivia.go
...
type ErrorResponse struct {
	Error   bool              `json:"error"`
	Data    map[string]string `json:"data,omitempty"`
	Message string            `json:"message,omitempty"`
}
...
func (s *Server) GetTrivia(e echo.Context) error {
	req := new(GetTriviaRequest)
	e.Bind(req)

	question, qIndex := s.Q.GetRandomQuestion(req.Category)
	if question == nil {
		return e.JSON(404, &ErrorResponse{
			Error: true,
			Data: map[string]string{
				"category": "category is invalid",
			},
		})
	}
	// randomly order answer choices if the format is multiple choice
	if question.Format == "MultipleChoice" && question.Choices != nil {
		rand.Shuffle(len(question.Choices), func(i, j int) {
			question.Choices[i], question.Choices[j] = question.Choices[j], question.Choices[i]
		})
		// enforce that multiple choice questions must have four choices
		// if not, there must be an error in our data somewhere that we need
		// to fix
		if len(question.Choices) != 4 {
			return e.JSON(500, &ErrorResponse{
				Error:   true,
				Message: "internal server error",
			})
		}
	}

	// build and return response
	tq := new(GetTriviaResponse)
	tq.QuestionId = question.Category + "|" + strconv.Itoa(qIndex)
	tq.Category = question.Category
	tq.Format = question.Format
	tq.Question = question.Question
	if tq.Format == "MultipleChoice" {
		tq.Choices = map[string]string{
			"A": question.Choices[0],
			"B": question.Choices[1],
			"C": question.Choices[2],
			"D": question.Choices[3],
		}
	}
	return e.JSONPretty(200, tq, "  ")
}
```
---
```go
// get_guess.go
...
func (s *Server) GetGuess(e echo.Context) error {
	req := new(GetGuessRequest)
	e.Bind(req)

	// ensure required parameters exist
	errs := make(map[string]string, 0)
	if req.Guess == "" {
		errs["guess"] = "required parameter missing"
	}
	if req.QuestionId == "" {
		errs["question_id"] = "required parameter missing"
	}
	if len(errs) > 0 {
		return e.JSON(400, &ErrorResponse{
			Error: true,
			Data:  errs,
		})
	}

	question := s.Q.GetQuestionById(req.QuestionId)
	if question == nil {
		errs["question_id"] = "invalid or malformed"
		return e.JSON(404, &ErrorResponse{
			Error: true,
			Data:  errs,
		})
	}

	// validate answer with case insensitive string compare
	correct := strings.EqualFold(question.Answer, req.Guess)

	return e.JSONPretty(200, &GetGuessResponse{req.QuestionId, correct}, "  ")
}
```

And verify that our tests are passing.

```bash
$ go test ./...                                                                                                       2:08:00 AM
ok      github.com/gabehf/trivia-tmp/server     0.006s
ok      github.com/gabehf/trivia-tmp/trivia     (cached)
```

## Loading Trivia Questions

Now that our handlers and Questions structure are working, and we can be sure that they are all working thanks to our tests, we can move onto the final (for now) step in our lower level modules and create the logic for loading trivia questions into our application. The questions will be stored in a file called `trivia.json` with a structure that mirrors the map `M` in our Questions structure.

```json
// trivia.json
{
  "category": [
    {
			"category": STRING,
      "question": STRING,
      "answer": STRING,
      "format": "MultipleChoice"|"TrueFalse",   
    },
    {
      ...
    }
  ],
  "category 2": [
    ...
  ]
}
```

You can find a `trivia.json` file with questions already filled in at https://GitHub.com/gabehf/trivia-api.

With our trivia file in place, we can make the method of our Questions struct that handles loading in JSON data. To make sure our function is testable, the method will take an io.Reader as an argument.

```go
// questions.go
...
func (q *Questions) Load(r io.Reader) error {
	q.lock.Lock()
	defer q.lock.Unlock()
	if q.M == nil {
		q.M = make(map[string][]Question, 0)
	}
	err := json.NewDecoder(r).Decode(&q.M)
	if err != nil {
		return err
	}
	if q.Categories == nil {
		q.Categories = make([]string, 0)
	}
	for key := range q.M {
		q.Categories = append(q.Categories, key)
	}
	return nil
}
```

And we can write a test to make sure our method works as expected using sample JSON data.

```go
// questions_test.go
...
func TestLoad(t *testing.T) {
	json := []byte(`
		{
			"world history": [
				{
					"category": "World History",
					"question": "How many years did the 100 years war last?",
					"answer": "116",
					"format": "MultipleChoice",
					"choices": [
						"116",
						"87",
						"12",
						"205"
					]
				},
				{
					"category": "World History",
					"question": "True or False: John Wilkes Booth assassinated Abraham Lincoln.",
					"answer": "True",
					"format": "TrueFalse"
				}
			],
			"geography": [
				{
					"category": "Geography",
					"question": "What is the capital city of Japan?",
					"answer": "Tokyo",
					"format": "MultipleChoice",
					"choices": [
						"Beijing",
						"Seoul",
						"Bangkok",
						"Tokyo"
					]
				},
				{
					"category": "Geography",
					"question": "True or False: The Amazon Rainforest is located in Africa.",
					"answer": "False",
					"format": "TrueFalse"
				}
			]
		}
	`)
	expectCategories := []string{"world history", "geography"}
	expectQuestions := map[string][]trivia.Question{
		"world history": {
			{
				Question: "How many years did the 100 years war last?",
				Format:   "MultipleChoice",
				Answer:   "116",
				Category: "World History",
				Choices: []string{
					"116",
					"87",
					"12",
					"205",
				},
			},
			{
				Question: "True or False: John Wilkes Booth assassinated Abraham Lincoln.",
				Format:   "TrueFalse",
				Answer:   "True",
				Category: "World History",
			},
		},
		"geography": {
			{
				Question: "What is the capital city of Japan?",
				Format:   "MultipleChoice",
				Answer:   "Tokyo",
				Category: "Geography",
				Choices:  []string{"Beijing", "Seoul", "Bangkok", "Tokyo"},
			},
			{
				Question: "True or False: The Amazon Rainforest is located in Africa.",
				Format:   "TrueFalse",
				Answer:   "False",
				Category: "Geography",
			},
		},
	}
	qq := new(trivia.Questions)
	qq.Init()
	err := qq.Load(bytes.NewReader(json))
	if err != nil {
		t.Errorf("expected error to be nil, got %v", err)
	}
	for _, cat := range expectCategories {
		if !slices.Contains(qq.Categories, cat) {
			t.Errorf("expected category %s not present", cat)
		}
	}
	if !reflect.DeepEqual(qq.M, expectQuestions) {
		t.Errorf("unexpected question map, got %v", qq.M)
	}
}
```

Now we can run our test and... voila! It passes! Now all that is left is updating our server's Run() function to load in our JSON data and mount our handlers, and create a main function to start the server. Let's get those out of the way.

```go
// server.go
...
func Run() error {
	// init server struct
	s := new(Server)
	s.Init()

	// load trivia data
	file, err := os.Open("trivia.json")
	if err != nil {
		panic(err)
	}
	err = s.Q.Load(file)
	if err != nil {
		panic(err)
	}

	// create router and mount handlers
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.GET("/trivia", s.GetTrivia)
	e.GET("/guess", s.GetGuess)

	// start listening
	return e.Start(":3000")
}
```
---
```go
// main.go
package main

import (
	"log"

	"github.com/gabehf/trivia-api/server"
)

func main() {
	log.Println("Trivia API listening on http://127.0.0.1:3000")
	log.Fatal(server.Run())
}
```

At last our trivia is complete. Let's run our application and make some requests.

```bash
$ go run .  
2023/12/09 05:10:39 Trivia API listening on http://127.0.0.1:3000

   ____    __
  / __/___/ /  ___
 / _// __/ _ \/ _ \
/___/\__/_//_/\___/ v4.11.3
High performance, minimalist Go web framework
https://echo.labstack.com
____________________________________O/_______
                                    O\
⇨ http server started on [::]:3000
```
---
```bash
$ curl 127.0.0.1:3000/trivia
{
  "question_id": "World History|2",
  "question": "Which world leader is famous for his "Little Red Book"?",
  "category": "World History",
  "format": "MultipleChoice",
  "choices": {
    "A": "Ho Chi Minh",
    "B": "Kim Jong-Un",
    "C": "Xi Xinping",
    "D": "Mao Zedong"
  }
}
```

Let's see... I think that this was Mao Zedong. Let's check my answer.

```bash
$ curl '127.0.0.1:3000/guess?question_id=World+History%7C2&guess=Mao+Zedong'
{
  "question_id": "World History|2",
  "correct": true
}
```

There we go! Our trivia API works! Now the only thing left to do in order to satisfy this post's title is to containerize it. Let's add a Dockerfile to our project root.

```docker
## syntax=docker/dockerfile:1
FROM golang:1.21
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY ./server/*.go ./server/
COPY ./trivia/*.go ./trivia/
COPY trivia.json ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /TriviaAPI
CMD ["/TriviaAPI"]
```

Then, we can build our docker image and run it.

```bash
$ docker build --tag trivia-api .
[+] Building 57.4s (16/16) FINISHED
...
$ docker run -p 3000:3000 trivia-api
2023/12/09 05:50:06 Trivia API listening on http://127.0.0.1:3000

   ____    __
  / __/___/ /  ___
 / _// __/ _ \/ _ \
/___/\__/_//_/\___/ v4.11.3
High performance, minimalist Go web framework
https://echo.labstack.com
____________________________________O/_______
                                    O\
⇨ http server started on [::]:3000
```

And let's test out our containerized trivia server.

```bash
$ curl 127.0.0.1:3000/trivia
{
  "question_id": "Art|6",
  "question": "Vincent Van Gogh is considered by many to be Post-Impressionist, or \"The Father of ________\".",
  "category": "Art",
  "format": "MultipleChoice",
  "choices": {
    "A": "Expressionism",
    "B": "Impressionism",
    "C": "Post-Modernism",
    "D": "Modernism"
  }
}
```

Perfect! Now we have a functional, stateless, containerized trivia API with robust unit testing. Now I wouldn't call my code here perfect, not even close. We lack tiered logging, environment variables for the port and JSON file, a method to hot-reload our trivia questions, rate limiting, we could also add more tests to make sure every edge case is covered, etc. However, for the purposes of this (already long) blog post, we can call this complete. Maybe in the future I will take this baseline and turn it into what I would call a truly production-ready API.

I hope you enjoyed reading and following along with my programming process, and hopefully if you were a beginner at Go or back end development you were able to learn a little bit from this post. If I made a mistake somewhere, there isn't really a way to reach out to me other than my email so please send me an email if I made a truly egregious error. Thank you for reading!