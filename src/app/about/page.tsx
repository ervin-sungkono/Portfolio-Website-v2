import Image from 'next/image';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile, skills } from '@/content/profile';
import { Experience } from '@/components/experience';
import { ExternalLink } from '@/components/external-link';
import { EngineeringHighlights } from '@/components/engineering-highlights';
import { pageMetadata, site } from '@/lib/metadata';
import styles from './about.module.css';
import avatar from '../../../public/images/hero-image.png';
import bnccLogo from '../../../public/images/bncc-logo-default.png';
import faveLogo from '../../../public/images/fave-logo-default.png';

const skillGroups = [
  {
    title: 'Web & Interface',
    labels: ['React', 'Next.js', 'JavaScript', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Bootstrap'],
  },
  {
    title: 'Application Development',
    labels: ['Node.js', 'Laravel', 'MySQL', 'Java', 'Android Studio'],
  },
  { title: 'Design & Tools', labels: ['Figma', 'Git'] },
].map(({ title, labels }) => ({
  title,
  items: skills.filter((skill) => labels.includes(skill.label)),
}));

export const metadata = pageMetadata({
  title: 'About — Software Engineering Experience',
  description: `Meet ${profile.name}, a software engineer at Samsung R&D Institute Indonesia with experience in frontend development, React, Next.js, and UI design.`,
  path: '/about',
});

const profileSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  '@id': `${site.url}/about#profile`,
  url: `${site.url}/about`,
  mainEntity: {
    '@type': 'Person',
    '@id': `${site.url}/#person`,
    name: profile.name,
    url: site.url,
    jobTitle: profile.title,
    sameAs: [profile.linkedin, profile.github, profile.dribbble],
  },
};

export default function AboutPage() {
  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileSchema).replace(/</g, '\\u003c') }}
      />
      <section className={`page-heading ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">About {profile.name}</p>
          <h1>
            Engineering, With
            <br />
            an Eye for Design.
          </h1>
          <p className={styles.intro}>
            {profile.intro} I enjoy exploring how technology and good interface design can work
            together.
          </p>
          <ExternalLink href={profile.cv} className="button button-outline">
            View CV <ArrowUpRightIcon size={19} aria-hidden="true" />
          </ExternalLink>
        </div>
        <div className={styles.avatarFrame}>
          <Image
            src={avatar}
            alt={`${profile.name}’s original illustrated portfolio avatar`}
            width={684}
            height={722}
            sizes="(min-width: 48rem) 24rem, min(20rem, calc(93.3333vw - 3.6667rem))"
            preload
          />
        </div>
      </section>
      <EngineeringHighlights />
      <Experience detailed />
      <section className={`section ${styles.skills}`}>
        <div className={styles.skillsHeading}>
          <p className="eyebrow">Skills & Tools</p>
          <h2>Tools I Work With.</h2>
          <p>
            A background across frontend development, application development, and interface design.
          </p>
        </div>
        <div className={styles.skillGroups}>
          {skillGroups.map((group) => (
            <div key={group.title} className={styles.skillGroup}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((skill) => (
                  <li key={skill.icon} className={styles.skillItem}>
                    <Image
                      src={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/icons/${skill.icon}.svg`}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                    />
                    <span>{skill.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className={`section ${styles.background}`}>
        <div className={styles.education}>
          <p className="eyebrow">Education</p>
          <h2>A Foundation in Computer Science.</h2>
          <p>
            {profile.education.degree}
            <br />
            {profile.education.school}, 2020-2024
          </p>
        </div>
        <div className={styles.backgroundStory}>
          <h3>Learning Through Collaboration</h3>
          <p>
            At Bina Nusantara Computer Club, I developed technical skills alongside teamwork, time
            management, and public speaking. As a FAVE Solution staff member, I worked with a team
            handling software projects.
          </p>
          <div className="organisation-links">
            <ExternalLink href="https://bncc.net">
              <Image
                src={bnccLogo}
                alt="Bina Nusantara Computer Club"
                width={180}
                height={90}
                sizes="8.25rem"
              />
            </ExternalLink>
            <ExternalLink href="https://favesolution.com">
              <Image src={faveLogo} alt="FAVE Solution" width={140} height={90} sizes="8.25rem" />
            </ExternalLink>
          </div>
        </div>
      </section>
    </div>
  );
}
