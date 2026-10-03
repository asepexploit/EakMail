/**
 * Workflow Builder documentation (DESIGN_SYSTEM.md §7). A sticky table of contents on the left
 * and scrollable content on the right. Copy lives in features/docs/docs-content.ts; node facts
 * mirror the frozen contract. Bahasa Indonesia throughout.
 */
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { DOC_SECTIONS, NODE_DOCS } from '@/features/docs/docs-content';
import { DocBlockView } from '@/features/docs/DocBlockView';
import { NodeReference } from '@/features/docs/NodeReference';
import { featureStrings } from '@/features/shared/feature-strings';

const NODE_CATALOG_ID = 'katalog-node';

interface TocEntry {
  id: string;
  title: string;
}

// Derive count from the actual node catalog so the TOC label stays accurate.
const NODE_COUNT = NODE_DOCS.reduce((acc, group) => acc + group.nodes.length, 0);

export function DocsPage() {
  // Insert the node catalog entry after "variabel" so the TOC reads naturally.
  const toc: TocEntry[] = [];
  for (const s of DOC_SECTIONS) {
    toc.push({ id: s.id, title: s.title });
    if (s.id === 'variabel') {
      toc.push({ id: NODE_CATALOG_ID, title: `${featureStrings.docs.nodeCatalog} (${NODE_COUNT})` });
    }
  }

  const [active, setActive] = useState(toc[0]?.id ?? '');

  function scrollTo(id: string) {
    setActive(id);
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-text">{featureStrings.docs.title}</h1>
        <p className="text-sm text-text-muted">{featureStrings.docs.subtitle}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Sticky table of contents */}
        <nav className="lg:sticky lg:top-4 lg:w-56 lg:shrink-0">
          <ul className="flex flex-col gap-0.5">
            {toc.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(entry.id)}
                  className={cn(
                    'focus-ring w-full rounded-sm px-3 py-1.5 text-left text-sm transition',
                    active === entry.id
                      ? 'bg-surface-2 font-medium text-text'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {DOC_SECTIONS.map((section) => (
            <div key={section.id} className="flex flex-col gap-4">
              <section id={`doc-${section.id}`} className="scroll-mt-4">
                <Card title={section.title}>
                  <div className="flex flex-col gap-3">
                    {section.blocks.map((block, i) => (
                      <DocBlockView key={i} block={block} />
                    ))}
                  </div>
                </Card>
              </section>
              {/* The full node catalog follows the "variabel" section (matches TOC order). */}
              {section.id === 'variabel' && (
                <section id={`doc-${NODE_CATALOG_ID}`} className="scroll-mt-4">
                  <Card title={featureStrings.docs.nodeCatalog}>
                    <NodeReference />
                  </Card>
                </section>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
