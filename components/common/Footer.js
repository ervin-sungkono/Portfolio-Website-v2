import Link from "next/link"
import styles from "../../styles/Footer.module.css"
import { AiFillMail } from '@react-icons/all-files/ai/AiFillMail'

export default function Footer(){
    return(
        <footer id="footer-section">
            <div className={`${styles["container"]} py-8 md:py-12`}>
                <div className={styles["footer-content"]}>
                    <h2>Contact Me</h2>
                    <div className="hr"></div>
                    <Link href="mailto:ervinsung@gmail.com" className="btn btn-secondary flex gap-2 items-center">
                        <AiFillMail/>
                        <p>ervinsung@gmail.com</p>
                    </Link>
                </div>
                <p>Copyright © Ervin Cahyadinata Sungkono 2023</p>
            </div>
        </footer>
    )
}