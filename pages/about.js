import Layout from "../components/Layout"
import AboutSection from "../components/AboutSection"
import SkillSection from "../components/SkillSection"
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