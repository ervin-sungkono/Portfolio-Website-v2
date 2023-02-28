import styles from "../styles/DribbbleSection.module.css"
import Link from "next/link"

import { Card } from "../lib/cardHover"
import { useEffect } from "react"
import ImageWithFallback from "./ImageWithFallback"

export default function DribbbleSection({title, dribbbleShots}){
    useEffect(() => {
        const shots = document.querySelectorAll(`.${styles["shot"]}`)
        shots.forEach(shot => new Card(shot, 3/4))
    })
    return (
        <section className={`${styles["container"]} py-8 md:py-12`}>
            <h2>{title}</h2>
            <div className="hr"></div>
            <div className={styles["dribbble-shots"]}>
                {dribbbleShots.map(shot => (
                    <div className={`${styles["shot"]}`} key={shot.id} data-aos="fade-up">
                        <Link href={shot.html_url} target="_blank">
                            <ImageWithFallback
                                src={shot.images.normal}
                                fallbackSrc={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/no-image.png`}
                                fill
                                alt={shot.title}
                            />
                            <div className="shot-overlay bg-black/[0.6] dark:bg-white/[0.7]">
                                <h3>{shot.title}</h3>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
            <button className={`btn btn-primary ${styles["more-btn"]}`}>
                <p>See More</p>
            </button>
        </section>
    )
}