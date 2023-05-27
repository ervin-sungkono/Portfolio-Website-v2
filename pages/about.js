import dynamic from "next/dynamic"

import Layout from "../components/layout/Layout"
const AboutSection = dynamic(() => import("../components/about/AboutSection"))
const SkillSection = dynamic(() => import("../components/about/SkillSection"))
import { getSkillsData } from "../lib/fetch"

export default function About({skills}) {
    return(
        <Layout title={"Ervin | About Me"}>
            <AboutSection/>
            <SkillSection skills={skills}/>
        </Layout>
    )
}

export async function getStaticProps(){
    const skills = await getSkillsData()

    return {
        props: {
            skills: skills
        }
    }
}