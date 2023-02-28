import Layout from "../components/Layout"
import GithubSection from "../components/GithubSection"
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
      },
      revalidate: 60
    }
  }