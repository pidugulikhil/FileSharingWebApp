import React from 'react';
import { Github as GitHub, Instagram, Linkedin, ExternalLink, Globe } from 'lucide-react';
import { SocialLink } from '../types';

const socialLinks: SocialLink[] = [
  { name: 'LinkedIn', url: 'https://linkedin.com/in/pidugulikhil', icon: 'linkedin' },
  { name: 'Instagram', url: 'https://instagram.com/pidugulikhil', icon: 'instagram' },
  { name: 'GitHub', url: 'https://github.com/pidugulikhil', icon: 'github' },
  { name: 'Portfolio', url: 'https://likhil.42web.io', icon: 'globe' },
  { name: 'Linktree', url: 'https://linktr.ee/pidugulikhil', icon: 'link' }
];

const Footer: React.FC = () => {
  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'github':
        return <GitHub className="w-5 h-5" />;
      case 'instagram':
        return <Instagram className="w-5 h-5" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5" />;
      case 'globe':
        return <Globe className="w-5 h-5" />;
      case 'link':
        return <ExternalLink className="w-5 h-5" />;
      default:
        return <ExternalLink className="w-5 h-5" />;
    }
  };

  return (
    <footer className="w-full mt-auto py-8 px-4 fade-in">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-3">
          <h3 className="text-xl font-semibold glow-text">Made by Likhil</h3>
        </div>

        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto">
          Minimal file sharing, maximum reach. Catch my latest product drops on LinkedIn, behind-the-scenes on Instagram, code on GitHub, and full portfolio at likhil.42web.io + Linktree.
        </p>

        <div className="flex justify-center space-x-4 flex-wrap gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full glass-effect glow-effect transition-all duration-300 hover:text-purple-400 interactive-cta"
            >
              {renderIcon(link.icon)}
            </a>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          © {new Date().getFullYear()} FileShareV1. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;