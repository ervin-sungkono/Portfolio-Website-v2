import dynamic from "next/dynamic"
import { getDribbbleUserData, getGithubUserData } from "../lib/fetch"

import Layout from "../components/layout/Layout"
const HeroSection = dynamic(() => import("../components/home/HeroSection"))
const AboutSection = dynamic(() => import("../components/about/AboutSection"))
const DribbbleSection = dynamic(() => import("../components/design/DribbbleSection"))
const GithubCarouselSection = dynamic(() => import("../components/home/GithubCarouselSection"))

export default function Home({dribbbleShots, githubProjects}) {
  return(
    <Layout 
      title="Ervin Cahyadinata Sungkono"
      description="Hello! im known as Ervin Cahyadinata Sungkono, a student at Binus University who has a passion for Web Development and Web Design. This is my personal website where i put my past projects and designs."
    >
      <HeroSection/>
      <AboutSection/>
      <DribbbleSection title={"Latest Dribbble shots!"} dribbbleShots={dribbbleShots}/>
      <GithubCarouselSection githubProjects={githubProjects.slice(0,7)}/>
    </Layout>
  )
}

export async function getStaticProps(){
  const dribbbleData = await getDribbbleUserData(6, true)
  const githubData = await getGithubUserData()

  return{
    props:{
      dribbbleShots: dribbbleData,
      githubProjects: githubData
    }
  }
}