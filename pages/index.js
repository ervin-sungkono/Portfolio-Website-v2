import dynamic from "next/dynamic"
import { getDribbbleUserData, getGithubUserData } from "../lib/fetch"

const Layout = dynamic(() => import("../components/Layout"))
const HeroSection = dynamic(() => import("../components/HeroSection"))
const AboutSection = dynamic(() => import("../components/AboutSection"))
const DribbbleSection = dynamic(() => import("../components/DribbbleSection"))
const GithubCarouselSection = dynamic(() => import("../components/GithubCarouselSection"))

export default function Home({dribbbleShots, githubProjects}) {
  return(
    <Layout title="Ervin Cahyadinata Sungkono">
      <HeroSection/>
      <AboutSection/>
      <DribbbleSection title={"Latest Dribbble shots!"} dribbbleShots={dribbbleShots.slice(0,6)}/>
      <GithubCarouselSection githubProjects={githubProjects.slice(0,8)}/>
    </Layout>
  )
}

export async function getStaticProps(){
  const dribbbleData = await getDribbbleUserData()
  const githubData = await getGithubUserData()

  return{
    props:{
      dribbbleShots: dribbbleData,
      githubProjects: githubData
    }
  }
}