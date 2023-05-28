import styles from "../../styles/SkillSection.module.css"
import Image from "next/image"
import { Tooltip } from "flowbite-react"
import { useTheme } from "next-themes"

export default function SkillSection({skills}){
    const {theme} = useTheme()
    return(
        <section className={`${styles["container"]} py-8 md:py-12`}>
            <div className={styles["skill-content"]}>
                <h2>My Skills</h2>
                <div className="hr"></div>
                <div className="skills grid grid-cols-5 gap-3">
                    {skills.map(skill => (
                        <Tooltip placement="bottom" content={skill.label} key={skill.label}>
                            <div className="bg-white dark:bg-neutral-700 p-2 md:p-3 rounded hover:bg-blue-200 dark:hover:bg-blue-500 hover:-translate-y-2 cursor-pointer transition duration-300 shadow-md">
                                <Image 
                                    src={skill.src}
                                    width={32}
                                    height={32}
                                    className={`${skill.label.toLowerCase() === 'nextjs' ? theme === "dark" ? "invert" : "" : ""}`}
                                    style={{aspectRatio: '1 / 1', objectFit: 'contain'}}
                                    alt=""
                                    key={skill}
                                />
                            </div>
                        </Tooltip>
                        
                    ))}
                </div>
            </div>
        </section>
    )
}