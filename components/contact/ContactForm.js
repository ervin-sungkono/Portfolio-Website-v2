import dynamic from "next/dynamic";
import styles from "../../styles/ContactForm.module.css"

import ReCAPTCHA from "react-google-recaptcha";
import Section from "../common/Section";
import { useRef, useState } from "react";
import { useTheme } from "next-themes";
const FloatingInputField = dynamic(() => import("./FloatingInputField"))

export default function ContactForm(){
    const reCAPTCHAref = useRef()
    const {theme} = useTheme()
    const [errorMesssage, setErrorMessage] = useState({
        name: "",
        email: "",
        subject: "",
        message: ""
    })
    const [reCAPTCHAToken, setReCAPTCHAToken] = useState(null)

    const onSubmitWithReCAPTCHA = async (e) => {
        e.preventDefault()
        const token = reCAPTCHAToken ?? await reCAPTCHAref.current.executeAsync()

        if(!token) return
        if(!reCAPTCHAToken) setReCAPTCHAToken(token)

        const name = document.getElementById("name").value
        const subject = document.getElementById("subject").value
        const email = document.getElementById("email").value
        const message = document.getElementById("message").value

        let errorArray = {
            name: "",
            email: "",
            subject: "",
            message: ""
        }
        setErrorMessage(errorArray)
        let isValid = true
        if(name.length === 0){
            errorArray.name = "Name must be filled"
            isValid = false
        }
        if(subject.length === 0) {
            errorArray.subject = "Subject must be filled"
            isValid = false
        }
        if(email.length === 0) {
            errorArray.email = "Email must be filled"
            isValid = false
        }
        if(message.length === 0) {
            errorArray.message = "Message must be filled"
            isValid = false
        }
        setErrorMessage(errorArray)
        
        if(isValid){
            await fetch("/api/contact", { 
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    subject: subject,
                    email: email,
                    message: message,
                    recaptcha_token: token
                })
            })
            .then(res => {
                if(res.ok){
                    alert("Form has been submitted")
                }else{
                    alert("Fail to submit form")
                }
            })

            e.target.reset()
        }
    }
    return(
        <Section title={"Get in touch"} className={styles.container}>
            <form 
                className="w-full max-w-xl p-4 md:p-6 flex flex-col gap-4 shadow-lg bg-white dark:bg-neutral-800 dark:shadow-gray-700 rounded-lg"
                onSubmit={onSubmitWithReCAPTCHA}
            >
                <FloatingInputField name={"name"} label={"Name"} errorMessage={errorMesssage.name}/>
                <FloatingInputField name={"subject"} label={"Subject"} errorMessage={errorMesssage.subject}/>
                <FloatingInputField type={"email"} name={"email"} label={"Email"} errorMessage={errorMesssage.email}/>
                <FloatingInputField name={"message"} label={"Message"} textarea errorMessage={errorMesssage.message}/>
                <ReCAPTCHA 
                    ref={reCAPTCHAref}
                    size="invisible"
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_KEY}
                    theme={theme}
                />
                <button type="submit" className="btn btn-primary mt-6">Submit</button>
            </form>
        </Section>
    )
}