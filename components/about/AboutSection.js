import Image from "next/image"
import Link from "next/link"
import styles from "../../styles/AboutSection.module.css"
import { useTheme } from "next-themes"

import BNCCLogoDefault from "../../public/images/bncc-logo-default.png"
import BNCCLogoWhite from "../../public/images/bncc-logo-white.png"
import FAVELogoDefault from "../../public/images/fave-logo-default.png"
import FAVELogoWhite from "../../public/images/fave-logo-white.png"

import Section from "../common/Section"

export default function AboutSection(){
    const {theme} = useTheme()
    return (
        <Section title={"About me"} id="about-section" className={styles.container}>
            <div className={styles["about-description"]} data-aos="fade-up">
                <p>Hello! I'm a student at Binus University who has a passion for Web Development and Design. I like to focus and work hard when it comes to my passion. This is my personal website which I intend to use for sharing my personal designs and projects.</p>
                <div className={styles["section-wrapper"]}>
                    <Link href="https://bncc.net" target="_blank">
                        <Image src={theme === 'light' ? BNCCLogoDefault : BNCCLogoWhite} alt="" width={240}/>
                    </Link>
                    <p>I joined a student organization called BNCC (Bina Nusantara Computer Club), became an activist and learned new soft skills such as public speaking, time management, and teamwork. I also learn hard skills like Web Development, Mobile Development, and UI Design.</p>
                </div>
                <div className={styles["section-wrapper"]}>
                    <p>While working for BNCC, I am entrusted the position of FAVE Solution Staff. My job is to work with team on handling software projects.</p>
                    <Link href="https://favesolution.com" target="_blank">
                        <Image src={theme === 'light' ? FAVELogoDefault : FAVELogoWhite} alt="" width={240}/>
                    </Link>
                </div>
            </div>
        </Section>
    )
}