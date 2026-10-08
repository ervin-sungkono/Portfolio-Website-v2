import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile, skills } from '@/content/profile';
import { Experience } from '@/components/experience';
import { ExternalLink } from '@/components/external-link';
import { EngineeringHighlights } from '@/components/engineering-highlights';

export const metadata: Metadata = {
  title: 'About',
  description: profile.intro,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="container snap-sections">
      <section className="about-hero page-heading">
        <div>
          <p className="eyebrow">About Ervin</p>
          <h1>
            Engineering, With
            <br />
            an Eye for Design.
          </h1>
          <p>
            {profile.intro} I enjoy exploring how technology and good interface design can work
            together.
          </p>
          <ExternalLink href={profile.cv} className="button button-outline">
            View CV <ArrowUpRightIcon size={19} aria-hidden="true" />
          </ExternalLink>
        </div>
        <div className="avatar-frame">
          <Image
            src="/images/hero-image.png"
            alt="Ervin’s original illustrated portfolio avatar"
            width={684}
            height={722}
            sizes="(max-width: 767px) 280px, 360px"
            preload
          />
        </div>
      </section>
      <Experience detailed />
      <EngineeringHighlights />
      <section className="skills-section section">
        <div className="section-heading">
          <h2>Tools I Work With.</h2>
          <p>
            A background across frontend development, application development, and interface design.
          </p>
        </div>
        <div className="skills-grid">
          {skills.map((skill) => (
            <div className="skill-item" key={skill.icon}>
              <Image
                src={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/icons/${skill.icon}.svg`}
                alt=""
                width={28}
                height={28}
                unoptimized
              />
              <span>{skill.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="background-section section">
        <div>
          <h2>A Foundation in Computer Science.</h2>
          <p>
            {profile.education.degree}
            <br />
            {profile.education.school}, 2020-2024
          </p>
        </div>
        <div className="background-story">
          <h3>Learning Through Collaboration</h3>
          <p>
            At Bina Nusantara Computer Club, I developed technical skills alongside teamwork, time
            management, and public speaking. As a FAVE Solution staff member, I worked with a team
            handling software projects.
          </p>
          <div className="organisation-links">
            <ExternalLink href="https://bncc.net">
              <Image
                src="/images/bncc-logo-default.png"
                alt="Bina Nusantara Computer Club"
                width={180}
                height={90}
              />
            </ExternalLink>
            <ExternalLink href="https://favesolution.com">
              <Image
                src="/images/fave-logo-default.png"
                alt="FAVE Solution"
                width={140}
                height={90}
              />
            </ExternalLink>
          </div>
        </div>
      </section>
    </div>
  );
}
