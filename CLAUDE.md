# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static landing page for **razzapazza.com**, hosted via GitHub Pages with a custom domain (configured in `CNAME`). The site displays a centered title, accent line, and year using the Lora serif font from Google Fonts.

## Architecture

- **index.html** — Single-page HTML with no build step or JavaScript
- **style.css** — All styling, including responsive breakpoints for mobile (`max-width: 600px`)
- **CNAME** — Custom domain config for GitHub Pages (`razzapazza.com`)

## Development

No build tools, package manager, or test framework. Open `index.html` directly in a browser to preview changes.

## Deployment

Pushes to `main` deploy automatically via GitHub Pages.
