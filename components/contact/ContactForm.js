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
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleChange = (value) => {
        setReCAPTCHAToken(value)
    }
    
    const onSubmitWithReCAPTCHA = async(e) => {
        e.preventDefault()
        if(isSubmitting) return
        setIsSubmitting(true)
        const token = reCAPTCHAToken ?? await reCAPTCHAref.current.executeAsync()

        const name = document.getElementById("name").value.trim()
        const subject = document.getElementById("subject").value.trim()
        const email = document.getElementById("email").value.trim()
        const message = document.getElementById("message").value.trim()

        let errorArray = {
            name: "",
            subject: "",
            email: "",
            message: ""
        }
        setErrorMessage((errorMesssage) => ({...errorMesssage, ...errorArray}))
        let isValid = true
        if(name.length === 0){
            setErrorMessage((errorMesssage) => ({...errorMesssage, name: "Name must be filled"}))
            isValid = false
        }
        if(subject.length === 0){
            setErrorMessage((errorMesssage) => ({...errorMesssage, subject: "Subject must be filled"}))
            isValid = false
        }
        if(email.length === 0) {
            setErrorMessage((errorMesssage) => ({...errorMesssage, email: "Email must be filled"}))
            isValid = false
        }
        if(message.length === 0) {
            setErrorMessage((errorMesssage) => ({...errorMesssage, message: "Message must be filled"}))
            isValid = false
        }
        
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
            .then(res => res.json())
            .then(data => {
                if(data.success){
                    setReCAPTCHAToken(null)
                    alert("Form has been submitted")
                    e.target.reset()
                }else{
                    alert("Failed to submit form")
                }
            })
            .catch(err => console.log(err))
        }
        setIsSubmitting(false)
    }

    return(
        <Section title={"Get in touch"} className={styles.container}>
            <form 
                className="w-full max-w-xl px-4 py-6 md:px-6 md:py-8  shadow-lg bg-white dark:bg-neutral-800 dark:shadow-gray-700 rounded-lg"
                onSubmit={onSubmitWithReCAPTCHA}
            >
                <div className="flex flex-col gap-4">
                    <FloatingInputField name={"name"} label={"Name"} errorMessage={errorMesssage.name}/>
                    <FloatingInputField name={"subject"} label={"Subject"} errorMessage={errorMesssage.subject}/>
                    <FloatingInputField type={"email"} name={"email"} label={"Email"} errorMessage={errorMesssage.email}/>
                    <FloatingInputField name={"message"} label={"Message"} textarea errorMessage={errorMesssage.message}/>
                </div>
                <ReCAPTCHA 
                    ref={reCAPTCHAref}
                    size="invisible"
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_KEY}
                    theme={theme}
                    onChange={handleChange}
                />
                <button type="submit" className="w-full btn btn-primary mt-6">{isSubmitting ? "Loading.." : "Submit"}</button>
            </form>
        </Section>
    )
}