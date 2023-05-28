import dynamic from "next/dynamic"

import Layout from "../components/layout/Layout"
const ContactForm = dynamic(() => import("../components/contact/ContactForm"))

export default function Contact(){
    return(
        <Layout
            title={"Ervin | Contact"}
            description="Contact me if you have a question"
        >
            <ContactForm/>
        </Layout>
    )
}