import styles from '../styles/HeroSection.module.css'
import { AiFillDribbbleCircle, AiFillInstagram, AiFillLinkedin, AiOutlineArrowDown } from 'react-icons/ai'
import Typewriter from 'typewriter-effect/dist/core'
import { useEffect } from 'react'
import { ScrollIntoView } from '../lib/scroll'
import Link from 'next/link'
import Image from 'next/image'

import HeroImage from '../public/images/hero-image.png'
import Square from '../public/images/rectangle.png'

export default function HeroSection(){
    const socials = [
        {url: "https://www.instagram.com/ervin.cs_09/", label: <AiFillInstagram size={24}/>},
        {url: "https://www.linkedin.com/in/ervin-cahyadinata-sungkono-970a691b6/", label: <AiFillLinkedin size={24}/>},
        {url: "https://dribbble.com/ErvinCS", label: <AiFillDribbbleCircle size={24}/>}
    ]
    const typewriterConfig = {
        autoStart: true,
        loop: true,
        delay: 80,
        deleteSpeed: 50,
    }
    useEffect(() => {
        const typewriter = new Typewriter('#heading-typewriter', typewriterConfig)
        typewriter
            .typeString('Ervin Cahyadinata<br>Sungkono')
            .pauseFor(5000)
            .start()
    })
    return (
        <section className={`${styles.container} py-6 md:py-16`}>
            <div className={styles["hero-content"]}>
                <div className={styles["heading-text"]}>
                    <p>Hello, my name is</p>
                    <div className={styles["heading-name"]}>
                        <h1 id="heading-typewriter"></h1>
                        <h1 id="name-text">Ervin Cahyadinata<br/>Sungkono</h1>
                    </div>
                    <p>Web Developer & Web Designer</p>
                </div>
                <Link href="https://drive.google.com/file/d/1cODpw-zhF3dpDGRBxN0HlxOI1ywUYUbK/view?usp=sharing" className="btn btn-primary" target="_blank">
                    <p>See My CV</p>
                </Link>
            </div>
            <div className={styles["social-media-links"]}>
                {socials.map((social, i) => (
                    <div className={`${styles["social-media"]} hover:text-white transition-colors duration-300`} key={i}>
                        <Link href={social.url} target="_blank">
                            {social.label}
                        </Link>
                    </div>
                ))}
            </div>
            <div className="relative px-4 sm:px-0">
                <Image src={HeroImage} width={400} height={400} quality={100} alt="Gambar Ervin" className="relative animate-float"/>
                <Image src={Square} width={360} height={360} priority={true} className="-z-10 absolute rotate-12 top-0 right-2 animate-rotate scale-75" alt="-"/>
            </div>
            <div className={styles["arrow-btn"]} onClick={() => ScrollIntoView({id: 'about-section', block: 'center'})}>
                <div className='cursor-pointer hover:text-white transition-colors duration-300'>
                    <AiOutlineArrowDown size={24}/>
                </div>
            </div>
        </section>
    )
}