import dynamic from "next/dynamic";

import styles from "../styles/GithubSection.module.css"
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'

const GithubCard = dynamic(() => import("./GithubCard"))

export default function GithubSection({githubProjects, categories}){
    return(
        <div className={`${styles["container"]} py-8 md:py-12`}>
            <h2>My Github Projects</h2>
            <div className="hr"></div>
            <Tabs className="w-full">
                <TabList>
                    {categories.map(category => (
                        <Tab>{category}</Tab>
                    ))}
                </TabList>
                {categories.map(category => (
                    <TabPanel className={styles["github-projects"]}>
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