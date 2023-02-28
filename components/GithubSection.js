import styles from "../styles/GithubSection.module.css"
import GithubCard from "./GithubCard"

export default function GithubSection({githubProjects}){
    return(
        <div className={`${styles["container"]} py-8 md:py-12`}>
            <h2>My Github Projects</h2>
            <div className="hr"></div>
            <div className={styles["github-projects"]}>
                {githubProjects.map(project => (
                    <GithubCard project={project}/>
                ))}
            </div>
        </div>
    )
}