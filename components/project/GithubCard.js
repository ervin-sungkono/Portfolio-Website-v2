import styles from "../../styles/GithubCard.module.css"
import Link from "next/link"
import { formatDate } from "../../lib/date"

import { AiFillGithub } from "@react-icons/all-files/ai/AiFillGithub"
import { IoBrowsersOutline } from "@react-icons/all-files/io5/IoBrowsersOutline"

import ImageWithFallback from "../common/ImageWithFallback"
import ImageModal from "../common/ImageModal"


export default function GithubCard({project}){
    return(
        <div className={`${styles["project"]} mb-4`}>
            <ImageModal 
                imageSrc={project.image} 
                imageAlt={project.name}
            >
                <div className={`${styles["project-img"]} group relative border border-black/25 dark:border-white/25 overflow-hidden`} data-aos="fade-up">
                    <ImageWithFallback
                        src={project.image}
                        fallbackSrc={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/no-image.png`}
                        fill
                        style={{aspectRatio: '16 / 10', objectFit: 'cover'}}
                        alt={project.name}
                        className="group-hover:scale-[1.15] transition-transform duration-700 ease-in-out"
                    />
                </div>
            </ImageModal>
            <div className={styles["project-content"]} data-aos="fade-up">
                <h3>{project.name}</h3>
                <div className="mb-2 text-xs md:text-sm">{formatDate(new Date(project.created_at))}</div>
                <p className="mb-2">{project.description}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                    {project.topics.map((topic, index) => (
                        <span className="text-xs text-black dark:text-white rounded-full px-2 py-1 border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors duration-200" key={index}>{topic}</span>
                    ))}
                </div>
            </div>
            <div className={styles["button-wrapper"]}>
                {project.homepage &&
                <Link href={project.homepage} className="btn btn-secondary" target="_blank">
                    <IoBrowsersOutline size={18}/>
                    <p>Website</p>
                </Link>}
                <Link href={project.html_url} className="btn btn-primary" target="_blank">
                    <AiFillGithub size={20}/>
                    <p>Github</p>
                </Link>
            </div>
        </div>
    )
}