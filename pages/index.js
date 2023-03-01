import Layout from "../components/Layout"
import { getDribbbleUserData, getGithubUserData } from "../lib/fetch"
import HeroSection from "../components/HeroSection"
import AboutSection from "../components/AboutSection"
import DribbbleSection from "../components/DribbbleSection"
import GithubCarouselSection from "../components/GithubCarouselSection"

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