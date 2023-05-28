import Link from "next/link"
import styles from "../../styles/Footer.module.css"
import { AiFillMail } from '@react-icons/all-files/ai/AiFillMail'

export default function Footer(){
    return(
        <footer id="footer-section">
            <div className={`${styles["container"]} py-8 md:py-12`}>
                <div className={styles["footer-content"]}>
                    <h3>Get in touch</h3>
                    <div className="hr"></div>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-sm md:text-base">Click the button below to reach me out!</p>
                        <Link href="/contact" className="btn btn-secondary flex gap-2 items-center">
                            <AiFillMail/>
                            <p>Contact Me</p>
                        </Link>
                    </div>
                </div>
                <p>Copyright © Ervin Cahyadinata Sungkono 2023</p>
            </div>
        </footer>
    )
}