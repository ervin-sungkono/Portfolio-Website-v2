import styles from "../styles/GithubCarouselSection.module.css"
import { useEffect, useRef } from "react";
import Glide from "@glidejs/glide";
import Link from "next/link";
import ImageWithFallback from "./ImageWithFallback";
import { AiOutlineArrowLeft, AiOutlineArrowRight, AiFillGithub } from "react-icons/ai"
import { IoBrowsersOutline } from "react-icons/io5"
import { formatDate } from "../lib/date";

const glideConfig = {
    type: "carousel",
    perView: 1,
    startAt: 0,
    swipeThreshold: 50,
    dragThreshold: false,
    throttle: 25,
    autoplay: 5000,
    focusAt: "center",
    gap: 16,
    hoverpause: true,
};

export default function GithubCarouselSection({githubProjects}){
    const ref = useRef()
    useEffect(() => {
        const carousel = new Glide(ref.current, glideConfig)
        carousel.mount()
        return () => carousel.destroy()
    },[])
    return (
        <section className={`${styles["container"]} pb-8 md:pb-12`}>
            <h2>Github Projects</h2>
            <div className="hr"></div>
            <div className="glide-wrapper pb-8 md:pb-12">
                <div className="glide" ref={ref}>
                    <div className="glide__arrows hidden md:block" data-glide-el="controls">
                        <button className="glide__arrow glide__arrow--left" data-glide-dir="<">
                            <AiOutlineArrowLeft className="text-black dark:text-white"/>
                        </button>
                    </div>
                    <div className="glide__track" data-glide-el="track">
                        <ul className="glide__slides">
                            {githubProjects.map(project => (
                                <li className="glide__slide" key={project.id}>
                                    <ImageWithFallback
                                        src={project.image}
                                        fallbackSrc={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/no-image.png`}
                                        fill
                                        style={{objectFit: 'cover'}}
                                        alt={project.name}
                                    />
                                    <div className="overlay p-3 absolute left-0 w-full bg-black/50 backdrop-blur">
                                        <div className="flex justify-between mb-2">
                                            <div className="flex flex-col">
                                                <h2 className="text-white text-base md:text-lg mb-1">{project.name}</h2>
                                                <p className="text-white text-xs md:text-sm font-normal">{formatDate(new Date(project.created_at))}</p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                {project.homepage ? 
                                                    <Link href={project.homepage} className="text-white" target={"_blank"}>
                                                        <IoBrowsersOutline size={20}/>
                                                    </Link> 
                                                    : 
                                                    ""
                                                }
                                                <Link href={project.html_url} className="text-white" target={"_blank"}>
                                                    <AiFillGithub size={20}/>
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {project.topics.slice(0,3).map((topic, index) => (
                                                <span className="text-xs md:text-sm text-white rounded-full px-2 py-1 border border-white hover:bg-white hover:text-black transition-colors duration-200" key={index}>{topic}</span>
                                            ))}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="glide__arrows hidden md:block" data-glide-el="controls">
                        <button className="glide__arrow glide__arrow--right" data-glide-dir=">">
                            <AiOutlineArrowRight className="text-black dark:text-white"/>
                        </button>
                    </div>
                    <div className="glide__bullets bottom-0" data-glide-el="controls[nav]">
                        {githubProjects.map((project, index) => (
                            <button className="glide__bullet" data-glide-dir={`=${index}`} key={index}></button>
                        ))}
                    </div> 
                </div> 
            </div>
            <div className="mt-4" data-aos="fade-up">
                <Link href={"/github"} className="btn btn-primary">More Projects</Link>
            </div>
        </section>
    )
}