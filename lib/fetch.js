export async function getDribbbleUserData(){
    const dribbbleShots = await fetch(`https://api.dribbble.com/v2/user/shots?access_token=${process.env.NEXT_PUBLIC_DRIBBBLE_TOKEN}`)
        .then(res => res.json())
        .catch(error => console.log(error))
    return dribbbleShots ?? []
}

const keywords = ["html", "sass", "rest", "css", "js", "ssr", "ssg", "php", "api", "pdf"]
  
export async function getGithubUserData(){
    const githubUsername = process.env.NEXT_PUBLIC_GITHUB_USERNAME
    const githubProjects = await fetch(`https://api.github.com/users/${githubUsername}/starred`, {
            headers: {
                Authorization : `Bearer ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
            }
        })
        .then(res => res.json())
        .then(projects => {
            const filteredProjects = projects
                                    .filter(project => project.owner.login === githubUsername)
                                    .sort((projectA, projectB) => new Date(projectB.created_at) - new Date(projectA.created_at))
            return Promise.all(filteredProjects.map(async(project)=> {
                return {
                    ...project,
                    name: project.name.replaceAll('-', ' '),
                    topics: project.topics.map(topic => (
                    topic.split('-')
                        .map(word => {
                            keywords.forEach(keyword => {word = word.replaceAll(keyword, keyword.toUpperCase())})
                            return word[0].toUpperCase() + word.substring(1)
                        })
                        .join(' ')
                    )),
                    image: `https://raw.githubusercontent.com/${githubUsername}/web-assets/master/images/${project.id}.png`
                }
            }))
        })
        .catch(error => console.log(error))
    return githubProjects ?? []
}

export async function getSkillsData(){
    const skills = await fetch("https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/icons/icon.json")
                    .then(res => res.json())
                    .then(data => data["icons_url"])
                    .catch(error => console.log(error))
    return skills ?? []
}