import styles from "../../styles/DribbbleSection.module.css"
import dynamic from "next/dynamic"
import { useEffect } from "react"
import { Card } from "../../lib/cardHover"

import Section from "../common/Section"
const DribbbleCard = dynamic(() => import("./DribbbleCard"))

export default function DribbbleSection({title, dribbbleShots}){
    useEffect(() => {
        const shots = document.querySelectorAll(`.${styles.shot}`)
        shots.forEach(shot => new Card(shot, 3/4))
    })
    return (
        <Section title={title} className={`${styles["container"]} py-8 md:py-12`}>
            <div className={styles["dribbble-shots"]}>
                {dribbbleShots.map(shot => (
                    <div className={styles.shot} key={shot.id} data-aos="fade-up">
                        <DribbbleCard shot={shot}/>
                    </div>
                ))}
            </div>
        </Section>
    )
}