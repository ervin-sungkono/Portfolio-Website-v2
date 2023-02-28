import styles from "../styles/SkillSection.module.css"
import Image from "next/image"

export default function SkillSection({skills}){
    console.log(skills)
    return(
        <section className={`${styles["container"]} py-8 md:py-12`}>
            <div className={styles["skill-content"]}>
                <h2>My Skills</h2>
                <div className="hr"></div>
                <div className="skills grid grid-cols-5 gap-3">
                    {skills.map(skill => (
                        <div className="bg-neutral-700 p-2 md:p-3 rounded hover:bg-blue-500 hover:-translate-y-2 cursor-pointer transition duration-300">
                            <Image 
                                src={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/icons/${skill}.svg`}
                                width={32}
                                height={32}
                                className={`${skill === 'nextjs' ? "invert" : ""}`}
                                style={{aspectRatio: '1 / 1', objectFit: 'contain'}}
                                alt={"Skills Icon"}
                                key={skill}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}