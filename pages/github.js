import dynamic from "next/dynamic"

const Layout = dynamic(() => import("../components/Layout"))
const GithubSection = dynamic(() => import("../components/GithubSection"))
import { getGithubUserData } from "../lib/fetch"

export default function Github({githubProjects}) {
    return(
        <Layout title={"Ervin | Github"}>
            <GithubSection githubProjects={githubProjects}/>
        </Layout>
    )
}

export async function getStaticProps(){
    const githubData = await getGithubUserData()
  
    return{
      props:{
        githubProjects: githubData
      }
    }
  }