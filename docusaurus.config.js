// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
    scripts: [
      '/set-ebay-proxy.js',
    ],
  title: 'Cardboard Multiverse',
  tagline: 'Ultimate Sports Card Collecting Resource',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://MatthewCDoyle.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/cardboard_multiverse/',

  // GitHub pages deployment config.
  organizationName: 'MatthewCDoyle', // Your GitHub username
  projectName: 'cardboard_multiverse', // Your repo name

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/MatthewCDoyle/cardboard_multiverse/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl:
            'https://github.com/MatthewCDoyle/cardboard_multiverse/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    function apiProxyPlugin() {
      return {
        name: 'api-proxy-plugin',
        configureWebpack() {
          return {
            devServer: {
              proxy: [
                {
                  context: ['/api'],
                  target: 'http://127.0.0.1:8787',
                  changeOrigin: true,
                },
              ],
            },
          };
        },
      };
    },
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Cardboard Multiverse',
        logo: {
          alt: 'Cardboard Multiverse Logo',
          src: 'img/cardboard-multiverse-logo.png',
        },
        items: [
          {
            to: '/card-tracker',
            label: 'Card Tracker',
            position: 'left',
          },
          {
            to: '/store',
            label: 'Store',
            position: 'left',
          },
          {
            to: '/how-to',
            label: 'How-To Guides',
            position: 'left',
          },
          {
            to: '/articles',
            label: 'Articles',
            position: 'left',
          },
          {
            href: 'https://github.com/MatthewCDoyle/cardboard_multiverse',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'light',
        logo: {
          alt: 'Cardboard Multiverse Logo',
          src: 'img/cardboard-multiverse-logo.png',
          href: '/cardboard_multiverse/',
        },
        links: [
          {
            title: 'Resources',
            items: [
              {
                label: 'How-To Guides',
                to: '/how-to',
              },
              {
                label: 'Articles',
                to: '/articles',
              },
            ],
          },
          {
            title: 'Tools',
            items: [
              {
                label: 'Card Tracker',
                to: '/card-tracker',
              },
              {
                label: 'Store',
                to: '/store',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/MatthewCDoyle/cardboard_multiverse',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Cardboard Multiverse. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;