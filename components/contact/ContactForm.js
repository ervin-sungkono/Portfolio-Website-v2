import dynamic from "next/dynamic";
import styles from "../../styles/ContactForm.module.css"

import ReCAPTCHA from "react-google-recaptcha";
import Section from "../common/Section";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { initDismisses } from "flowbite";
import { IoClose } from "@react-icons/all-files/io5/IoClose"
const FloatingInputField = dynamic(() => import("./FloatingInputField"))

export default function ContactForm(){
    useEffect(() => {
        initDismisses()
    })
    const reCAPTCHAref = useRef()
    const {theme} = useTheme()
    const [errorMesssage, setErrorMessage] = useState({
        name: "",
        email: "",
        subject: "",
        message: ""
    })
    const [alertMessage, setAlertMessage] = useState({
        message: "",
        success: false
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
        setErrorMessage({...errorArray})
        setAlertMessage({
            message: "",
            success: false
        })
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
                    setAlertMessage({
                        message: "Form has been submitted",
                        success: true
                    })
                    e.target.reset()
                }else{
                    setAlertMessage({
                        message: "Failed to submit form",
                        success: true
                    })
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
                {alertMessage.message &&
                <div id="alert-box" className={`flex p-4 mt-4 ${alertMessage.success ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"} rounded-lg`} role="alert">
                    <div className="ml-3 text-sm font-medium">
                        {alertMessage.message}
                    </div>
                    <button type="button" className={`ml-auto -mx-1.5 -my-1.5 focus:ring-0 ${alertMessage.success ? "text-green-500 bg-green-50 hover:bg-green-200" : "text-red-500 bg-red-50 hover:bg-red-200"} rounded-lg focus:ring-2  p-1.5 inline-flex h-8 w-8`} data-dismiss-target="#alert-box" aria-label="Close">
                        <span className="sr-only">Close</span>
                        <IoClose size={20}/>
                    </button>
                </div>}
            </form>
        </Section>
    )
}