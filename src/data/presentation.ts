type Social = {
  label: string;
  link: string;
};

type Presentation = {
  mail: string;
  title: string;
  description: string;
  socials: Social[];
  profile?: string;
};

const presentation: Presentation = {
  mail: "gabe@mnrva.dev",
  title: "Hey, I’m Gabe 👋",
  // profile: "/profile.webp",
  description:
    "I'm a recent *CS graduate* with professional *full stack development* experience.\
     You will often find me working with *Go, NodeJS and Python*. I love\
     to spend my time learning everything I can about emerging technologies in *cloud computing* and\
     *API development*. When I'm not working, I play guitar and am an avid gamer.",
  socials: [
    {
      label: "View my GitHub",
      link: "https://github.com/gabehf",
    },
  ],
};

export default presentation;
