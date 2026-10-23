export type SocialPlatform = 'GitHub' | 'LinkedIn' | 'Dribbble' | 'Instagram';

export type FooterSocial = {
  name: SocialPlatform;
  href: string;
  Icon: typeof import('@phosphor-icons/react/dist/ssr').GithubLogoIcon;
};
