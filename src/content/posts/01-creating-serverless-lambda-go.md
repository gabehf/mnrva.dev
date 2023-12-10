---
title: "Creating Serverless Applications with AWS Lambda and Go"
publishedAt: 2023-11-23
description: "Learn how to deploy your first AWS Lambda serverless function using Go with this step-by-step guide."
slug: "creating-serverless-lambda-go"
isPublish: true
---
In recent years, serverless computing has become a popular choice for building scalable, flexible, and cost-effective applications. Using serverless solutions, you can focus on writing and deploying code, without having to worry about managing infrastructure. AWS Lambda, Amazon's serverless computing platform, provides a simple and efficient way to run code in response to events, without having to provision or manage servers. In this blog post, I'll take a look at how to build serverless applications using AWS Lambda and the Go programming language. I'll cover the basics of serverless computing, setting up an AWS Lambda function, and writing Go code to handle events and respond to requests. By the end of this post, you'll have a good understanding of how to build and deploy serverless applications using AWS Lambda and Go. Let's get started.

## What is Serverless?

Serverless computing is a paradigm shift in the way applications are built and deployed. Instead of having to manage servers and infrastructure, you can focus on writing and deploying code in small, independent functions. With serverless, you only pay for the compute time that your code consumes, making it a cost-effective solution for many use cases. Additionally, serverless provides automatic scaling, so you don't have to worry about overprovisioning or underprovisioning resources. This allows you to build and deploy applications faster and with less operational overhead. While there are many providers for serverless functions, in this blog post we will be focusing on AWS Lambda.

## Preparing your Go environment for AWS Lambda

Before we begin writing our function, we need to prepare our Go environment. First, we will create a new module that will contain our code. To do this, we can use the `go mod init` command.

```bash
go mod init github.com/my-user/GoLambda
```

Now that our module is set up, we can add dependencies using `go get`. To use AWS Lambda, we need the AWS lambda package. Let's add that to our module.

```bash
go get github.com/aws/aws-lambda-go/lambda
```

## Our First Lambda Application

Now that we have the necessary dependencies, we can create a file that will store our lambda handler. We can use the example file found in [https://github.com/aws/aws-lambda-go](http://github.com/aws/aws-lambda-go) to create our first Lambda handler.

```go
// main.go
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
)

func hello() (string, error) {
	return "Hello λ!", nil
}

func main() {
	// Make the handler available for Remote
    // Procedure Call by AWS Lambda
	lambda.Start(hello)
}
```

Let's break down what this file is doing. Our `main()` function is calling `lambda.Start()` on our `hello()` function. The function `lambda.Start(hello)` is telling Lambda to use our `hello()` function to process any requests made to our lambda application. So, when our Lambda application is called, our Go code will call `hello()`, which simply returns the string `"Hello λ!"`.

## Something a Little More Complex

Now that we have the basics on how to make a very simple AWS Lambda serverless application, lets use our knowledge to create an application that actually does something useful and deploy it to Lambda. Our application will take a JSON formatted request of two numbers, `A` and `B` and return the greatest common factor, also in JSON format.

To get started, lets modify our code with new structures that will define the format of our requests and responses, and a new handler function that will handle the requests from Lambda.

```go
// main.go
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
)

type Request struct {
	A int 
	B int 
}

type Response struct {
	Result int
}

func HandleRequests(ctx context.Context, req Request) (Response, error) {
	return Response{}, nil
}

func main() {
	// Make the handler available for Remote
    // Procedure Call by AWS Lambda
	lambda.Start(HandleRequests)
}
```

Let's go over what we have changed.

The `Request` structure defines how our requests to the lambda function will be formatted. We can see that inside the structure are the two integers that we will be finding the GCF of.

The `Response` structure defines how our response from Lambda will be send back to the requestor.

We have changed our handler function from `hello()` to `HandleRequests()`. The `HandleRequests()` function takes two arguments: 

- A context object that stores the context of the request being made to Lambda.
- The Request object that stores the actual values of the request.

Now we can add the logic into our application. We will use the Euclidean algorithm to determine the greatest common factor of the two numbers, and return the result in our `Response{}` structure.

```go
// main.go
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
)

type Request struct {
	A int 
	B int 
}

type Response struct {
	Result int
}

func GCF(a, b int) int {
	for b != 0 {
			t := b
			b = a % b
			a = t
	}
	return a
}

func HandleRequests(ctx context.Context, req Request) (Response, error) {
	return Response{Result: GCF(req.A, req.B)}, nil
}

func main() {
	// Make the handler available for Remote
    // Procedure Call by AWS Lambda
	lambda.Start(HandleRequests)
}
```

## Deploying our Application

### Compiling for Lambda

Now that our code is ready, we need to deploy the application to Lambda. To do this, first we need to compile our code. In order to compile into a binary that is readable by the Lambda environment, we need to make sure Go compiles for a linux amd64 system. We can do this with this command in our terminal:

```bash
GOOS=linux GOARCH=amd64 go build -o GoLambda main.go
```

Or on Windows Powershell (make sure you return the values to their defaults once you are done compiling),

```powershell
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o GoLambda main.go
```

This will compile our code into a binary called `GoLambda`. Then, we need to zip the binary. On Linux and MacOS, we can just use the command

```bash
zip lambda-handler.zip GoLambda
```

If you are on Windows, you must first install the build-lambda-zip utility in order to get a zip file that can be properly read by Lambda.

```bash
go.exe install github.com/aws/aws-lambda-go/cmd/build-lambda-zip@latest
```

Then run this command to zip the binary (assuming you have a default Go installation).

```bash
~\Go\Bin\build-lambda-zip.exe -o lambda-handler.zip bootstrap
```

### Deploying to Lambda

Now that we have a zipped binary file, we can deploy our function to Lambda. Go into your AWS console and create a new lambda function. We will name our function GoLambda and use the Go 1.x runtime. Leave everything else default and hit `Create Function`. Once our function is created, we can upload our code. Under `Code Source`, choose to `.zip file`, and upload to your lambda-handler.zip file that we just created.

When our code is uploaded, we need to edit the Runtime Settings and set the handler to be the name of our binary (in this case, GoLambda). 

### Testing our Application

To make sure our function works as intended and didn't encounter any errors when uploading, we can create a test for our function. To make the test, we can go to the testing tab in our function's console and create a new event. We can call our event myTest, and edit the JSON to be as follows:

```json
{
  "A": 36,
  "B": 48
}
```

Then, just click `Test`. Our test will run, and you should get a dialogue box with the message **Execution result: succeeded** and our Response payload.

```json
{
  "Result": 12
}
```

## Conclusion

That's it! Our Go Lambda serverless application is now live. Now that you have a basic understanding of how Go Lambda functions work, you can use this basic structure to build more and more advanced solutions. And as always when you are learning with AWS
services, remember to destroy anything you have created to avoid any unwanted bills.

*You can find the code for this post at github.com/gabehf/GoLambda*