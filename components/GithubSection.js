import dynamic from "next/dynamic";

import styles from "../styles/GithubSection.module.css"
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'

const GithubCard = dynamic(() => import("./GithubCard"))

export default function GithubSection({githubProjects, categories}){
    console.log(githubProjects)
    return(
        <div className={`${styles["container"]} py-8 md:py-12`}>
            <h2>My Github Projects</h2>
            <div className="hr"></div>
            <Tabs className="w-full">
                <TabList>
                    {categories.map(category => (
                        <Tab className="react-tabs__tab text-sm md:text-base" key={category}>{category}</Tab>
                    ))}
                </TabList>
                {categories.map(category => (
                    <TabPanel className={styles["github-projects"]} key={category}>
                        {category === "All" ? 
                        githubProjects.map(project => (
                                <GithubCard project={project} key={project.id}/>
                            )
                        )
                        :
                        githubProjects.filter(project => project.category.includes(category))
                            .map(project => (
                                <GithubCard project={project} key={project.id}/>
                            )
                        )}
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    )
}