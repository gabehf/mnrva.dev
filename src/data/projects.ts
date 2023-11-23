export type Project = {
  title: string;
  techs: string[];
  link: string;
  isComingSoon?: boolean;
};

const projects: Project[] = [
  {
    title: "Massflip",
    techs: ["Go", "Vue.js", "AWS", "MongoDB"],
    link: "https://github.com/gabehf/massflip",
  },
  {
    title: "CostIn.Coffee",
    techs: ["HTML/CSS/JS", "jQuery"],
    link: "https://costin.coffee",
  },
  {
    title: "Budget Buddy",
    techs: ["React", "Go", "MongoDB"],
    link: "https://github.com/gabehf/budgetbuddy",
  },
];

export default projects;
