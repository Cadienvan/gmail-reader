/**
 * Utility functions for sanitizing HTML content from emails
 * to prevent style conflicts with the application while preserving email formatting
 */

/**
 * Converts plain text URLs to anchor tags in HTML content
 */
function convertTextUrlsToAnchors(html: string): string {
  // Enhanced URL regex patterns for better detection
  const protocols = ['https?://', 'ftp://'];
  const domain = '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*';
  const port = '(?::[0-9]{1,5})?';
  const path = '(?:/[^\\s<>"\'()]*)?';
  
  // Pattern for URLs with protocols
  const protocolUrlRegex = new RegExp(`(?:${protocols.join('|')})${domain}${port}${path}`, 'gi');
  
  // Pattern for domain-only URLs (www.example.com, example.com)
  const domainOnlyRegex = new RegExp(`\\b(?:www\\.)?${domain}\\.[a-zA-Z]{2,}${port}${path}\\b`, 'gi');
  
  // Convert to DOM to safely process
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find all text nodes and convert URLs to links
  const walker = document.createTreeWalker(
    doc.body || doc,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip text nodes that are already inside anchor tags
        const parent = node.parentElement;
        if (parent?.tagName === 'A' || parent?.closest('a')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Only accept nodes that contain URLs
        const text = node.textContent || '';
        return (protocolUrlRegex.test(text) || domainOnlyRegex.test(text))
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const textNodesToProcess: { node: Text; protocolMatches: string[]; domainMatches: string[] }[] = [];
  let textNode: Text | null;
  
  // Collect all text nodes that need processing
  while (textNode = walker.nextNode() as Text) {
    const text = textNode.textContent || '';
    const protocolMatches = Array.from(text.matchAll(protocolUrlRegex)).map(match => match[0]);
    const domainMatches = Array.from(text.matchAll(domainOnlyRegex)).map(match => match[0]);
    
    if (protocolMatches.length > 0 || domainMatches.length > 0) {
      textNodesToProcess.push({ node: textNode, protocolMatches, domainMatches });
    }
  }

  // Process collected nodes (this avoids iterator invalidation)
  textNodesToProcess.forEach(({ node, protocolMatches, domainMatches }) => {
    if (!node.parentNode) return;
    
    let currentText = node.textContent || '';
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    
    // Combine all matches and sort by position in text
    const allMatches: { url: string; index: number; needsProtocol: boolean }[] = [];
    
    protocolMatches.forEach(url => {
      const urlIndex = currentText.indexOf(url);
      if (urlIndex !== -1) {
        allMatches.push({ url, index: urlIndex, needsProtocol: false });
      }
    });
    
    domainMatches.forEach(url => {
      const urlIndex = currentText.indexOf(url);
      if (urlIndex !== -1) {
        // Check if this domain is not already part of a protocol URL
        const isPartOfProtocolUrl = protocolMatches.some(protocolUrl => protocolUrl.includes(url));
        if (!isPartOfProtocolUrl) {
          allMatches.push({ url, index: urlIndex, needsProtocol: true });
        }
      }
    });
    
    // Sort by position in text
    allMatches.sort((a, b) => a.index - b.index);

    allMatches.forEach(({ url, needsProtocol }) => {
      const urlIndex = currentText.indexOf(url, lastIndex);
      if (urlIndex === -1) return;

      // Add text before URL
      if (urlIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(currentText.substring(lastIndex, urlIndex)));
      }

      // Create anchor tag for URL
      const anchor = document.createElement('a');
      const href = needsProtocol ? `https://${url}` : url;
      anchor.href = href;
      anchor.textContent = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      fragment.appendChild(anchor);

      lastIndex = urlIndex + url.length;
    });

    // Add remaining text
    if (lastIndex < currentText.length) {
      fragment.appendChild(document.createTextNode(currentText.substring(lastIndex)));
    }

    // Replace the original text node
    node.parentNode.replaceChild(fragment, node);
  });

  return doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
}

/**
 * Sanitizes HTML content by removing dangerous elements while preserving
 * email styling in an isolated container
 */
export function sanitizeEmailHTML(html: string): string {
  if (!html) return '';

  // First convert plain text URLs to anchor tags
  const htmlWithAnchors = convertTextUrlsToAnchors(html);

  // Create a temporary DOM element to parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlWithAnchors, 'text/html');

  // Remove script tags and other potentially harmful elements
  const dangerousElements = doc.querySelectorAll('script, link[rel="stylesheet"], meta, title, object, embed, iframe[src*="javascript:"]');
  dangerousElements.forEach(el => el.remove());

  // Process style tags - extract and scope them to email content
  const styleTags = doc.querySelectorAll('style');
  let scopedStyles = '';
  
  styleTags.forEach(styleTag => {
    const cssText = styleTag.textContent || '';
    if (cssText.trim()) {
      // Scope all CSS rules to the email container
      const scopedCss = scopeCSSToContainer(cssText, '.email-html-content');
      scopedStyles += scopedCss + '\n';
    }
    styleTag.remove();
  });

  // Remove inline event handlers for security
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const attributes = Array.from(el.attributes);
    attributes.forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Remove javascript: URLs
    const href = el.getAttribute('href');
    const src = el.getAttribute('src');
    if (href && href.toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('href');
    }
    if (src && src.toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('src');
    }
  });

  // Get the sanitized HTML from the body
  const body = doc.body;
  let sanitizedHTML = body ? body.innerHTML : '';

  // Wrap the content with scoped styles if any were found
  if (scopedStyles) {
    sanitizedHTML = `<style>${scopedStyles}</style>${sanitizedHTML}`;
  }

  return sanitizedHTML;
}

/**
 * Scopes CSS rules to a specific container to prevent style bleeding
 */
function scopeCSSToContainer(css: string, containerSelector: string): string {
  try {
    // First, remove problematic @-rules that could affect the entire page
    const cleanedCSS = css
      // Remove @media queries (including prefers-color-scheme, etc.)
      .replace(/@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      // Remove @import rules
      .replace(/@import[^;]*;/g, '')
      // Remove @charset rules
      .replace(/@charset[^;]*;/g, '')
      // Remove @namespace rules
      .replace(/@namespace[^;]*;/g, '')
      // Remove @supports rules
      .replace(/@supports[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      // Remove @document rules
      .replace(/@document[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      // Remove @page rules
      .replace(/@page[^{]*\{[^{}]*\}/g, '');

    // Simple CSS scoping - prepend container selector to each rule
    return cleanedCSS.replace(/([^{}]+)\{([^{}]+)\}/g, (match, selector, declarations) => {
      // Clean up the selector
      const cleanSelector = selector.trim();
      
      // Skip any remaining @-rules that might have been missed
      if (cleanSelector.startsWith('@')) {
        return '';
      }
      
      // Skip if already scoped
      if (cleanSelector.includes(containerSelector)) {
        return match;
      }
      
      // Skip selectors that target html, body, or other global elements
      if (/^(html|body|\*|:root)(\s|$|,)/i.test(cleanSelector)) {
        return '';
      }
      
      // Scope the selector
      const scopedSelector = `${containerSelector} ${cleanSelector}`;
      return `${scopedSelector} { ${declarations} }`;
    });
  } catch (error) {
    console.warn('Failed to scope CSS:', error);
    return css;
  }
}

/**
 * Extracts plain text from HTML while preserving basic formatting
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove script and style elements
  const unwantedElements = doc.querySelectorAll('script, style, noscript');
  unwantedElements.forEach(el => el.remove());
  
  // Get text content and clean up whitespace
  let text = doc.body?.textContent || doc.textContent || '';
  
  // Clean up excessive whitespace while preserving line breaks
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple line breaks to double
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
  text = text.trim();
  
  return text;
}

/**
 * Checks if the HTML content contains potentially problematic styles
 */
export function hasProblematicStyles(html: string): boolean {
  if (!html) return false;

  // Check for inline styles that commonly cause issues
  const problematicPatterns = [
    /style\s*=\s*["'][^"']*background/i,
    /style\s*=\s*["'][^"']*position\s*:\s*fixed/i,
    /style\s*=\s*["'][^"']*position\s*:\s*absolute/i,
    /style\s*=\s*["'][^"']*z-index/i,
    /style\s*=\s*["'][^"']*overflow\s*:\s*hidden/i,
    /<style[^>]*>/i,
    /<link[^>]*stylesheet/i,
    /@media[^{]*\{/i, // Media queries
    /@import/i, // Import rules
    /@supports/i, // Feature queries
    /prefers-color-scheme/i, // Color scheme preferences
    /prefers-reduced-motion/i, // Motion preferences
  ];

  return problematicPatterns.some(pattern => pattern.test(html));
}
