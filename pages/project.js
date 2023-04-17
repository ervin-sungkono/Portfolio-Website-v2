import dynamic from "next/dynamic"

const Layout = dynamic(() => import("../components/Layout"))
const GithubSection = dynamic(() => import("../components/GithubSection"))
import { getGithubUserData, getProjectCategories } from "../lib/fetch"

export default function Github({githubProjects, categories}) {
    return(
        <Layout title={"Ervin | Projects"}>
            <GithubSection githubProjects={githubProjects} categories={categories}/>
        </Layout>
    )
}

export async function getStaticProps(){
    const githubData = await getGithubUserData()
    const categories = await getProjectCategories()
  
    return{
      props:{
        githubProjects: githubData,
        categories: categories
      }
    }
  }