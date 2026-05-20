/**
 * Default Kanban: several distinct demo templates; each user gets one (by userId hash).
 * Assignee is always the current user so non-admin filtering still works.
 * Bump DEMO_SEED_VERSION when templates change so GET /api/board can refresh auto-demo boards.
 */

export const DEMO_SEED_VERSION = 4;

type TaskSeed = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags: string[];
};

type ColumnSeeds = {
  todo: TaskSeed[];
  progress: TaskSeed[];
  review: TaskSeed[];
  done: TaskSeed[];
};

/** Stable 32-bit hash so the same user always maps to the same template. */
function templateIndexForUser(userId: string, templateCount: number): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % templateCount;
}

const TEMPLATES: ColumnSeeds[] = [
  // 0 — Product / storefront
  {
    todo: [
      {
        title: 'Define checkout flow',
        description: 'Map cart, payment, shipping, and confirmation screens.',
        priority: 'high',
        dueDate: '2024-02-15',
        tags: ['Product', 'UX'],
      },
      {
        title: 'Competitor pricing scan',
        description: 'Capture pricing tiers for three comparable products.',
        priority: 'medium',
        dueDate: '2024-02-18',
        tags: ['Research'],
      },
      {
        title: 'Draft product copy',
        description: 'Headlines and CTAs for the landing hero and pricing page.',
        priority: 'low',
        tags: ['Copy', 'Marketing'],
      },
      {
        title: 'Inventory sync spec',
        description: 'Document how SKU counts update after each order.',
        priority: 'medium',
        tags: ['Backend', 'Spec'],
      },
    ],
    progress: [
      {
        title: 'Build cart service',
        description: 'Persist cart server-side with session and merge rules.',
        priority: 'high',
        dueDate: '2024-02-20',
        tags: ['Backend', 'API'],
      },
      {
        title: 'Stripe payment element',
        description: 'Integrate hosted fields and webhooks for paid orders.',
        priority: 'high',
        dueDate: '2024-02-22',
        tags: ['Payments'],
      },
      {
        title: 'Product grid UI',
        description: 'Responsive grid with filters and empty states.',
        priority: 'medium',
        tags: ['Frontend', 'UI'],
      },
    ],
    review: [
      {
        title: 'Refund policy review',
        description: 'Legal + support sign-off on edge cases.',
        priority: 'medium',
        tags: ['Review', 'Policy'],
      },
      {
        title: 'Checkout QA pass',
        description: 'Test cards, failures, and receipt emails.',
        priority: 'high',
        tags: ['QA'],
      },
      {
        title: 'Analytics events audit',
        description: 'Verify purchase funnel events in the data layer.',
        priority: 'low',
        tags: ['Analytics'],
      },
    ],
    done: [
      {
        title: 'Launched pilot catalog',
        description: 'First 20 SKUs live in staging.',
        priority: 'low',
        tags: ['Launch', 'Milestone'],
      },
      {
        title: 'SEO baseline',
        description: 'Meta tags and sitemap submitted.',
        priority: 'low',
        tags: ['SEO'],
      },
      {
        title: 'Support macros',
        description: 'Canned replies for common order questions.',
        priority: 'low',
        tags: ['Support'],
      },
    ],
  },
  // 1 — Mobile app
  {
    todo: [
      {
        title: 'Navigation IA',
        description: 'Tabs vs stack for primary flows; align with design.',
        priority: 'high',
        dueDate: '2024-02-15',
        tags: ['Mobile', 'UX'],
      },
      {
        title: 'Push notification spec',
        description: 'When to notify and deep-link targets.',
        priority: 'medium',
        tags: ['Notifications'],
      },
      {
        title: 'Offline sync outline',
        description: 'Which entities cache locally and conflict rules.',
        priority: 'medium',
        tags: ['Sync'],
      },
      {
        title: 'App Store assets',
        description: 'Screenshots and copy for submission.',
        priority: 'low',
        tags: ['Release'],
      },
    ],
    progress: [
      {
        title: 'Biometric login',
        description: 'Face ID / fingerprint with secure token storage.',
        priority: 'high',
        dueDate: '2024-02-21',
        tags: ['Security', 'iOS'],
      },
      {
        title: 'Camera capture flow',
        description: 'Permissions, preview, and upload queue.',
        priority: 'high',
        tags: ['Android', 'Camera'],
      },
      {
        title: 'List virtualization',
        description: 'Smooth scrolling for long feeds.',
        priority: 'medium',
        tags: ['Performance'],
      },
    ],
    review: [
      {
        title: 'Crash-free session review',
        description: 'Review Firebase Crashlytics for the last build.',
        priority: 'medium',
        tags: ['Stability'],
      },
      {
        title: 'Accessibility swipe gestures',
        description: 'Ensure alternative actions for non-gesture users.',
        priority: 'medium',
        tags: ['A11y'],
      },
      {
        title: 'Beta feedback triage',
        description: 'Prioritize top five issues from TestFlight.',
        priority: 'high',
        tags: ['Feedback'],
      },
    ],
    done: [
      {
        title: 'v1.2 shipped to production',
        description: 'Rollout complete and monitored.',
        priority: 'low',
        tags: ['Release'],
      },
      {
        title: 'Dark mode polish',
        description: 'Contrast fixes and asset swaps.',
        priority: 'low',
        tags: ['UI'],
      },
      {
        title: 'Instrumentation baseline',
        description: 'Core screens tracked in analytics.',
        priority: 'low',
        tags: ['Analytics'],
      },
    ],
  },
  // 2 — Data / analytics
  {
    todo: [
      {
        title: 'Source inventory',
        description: 'List all DBs, APIs, and files feeding the warehouse.',
        priority: 'high',
        tags: ['Data', 'Discovery'],
      },
      {
        title: 'KPI definition workshop',
        description: 'Align on North Star and guardrail metrics.',
        priority: 'high',
        dueDate: '2024-02-16',
        tags: ['Metrics'],
      },
      {
        title: 'PII classification',
        description: 'Tag columns that need masking or exclusion.',
        priority: 'medium',
        tags: ['Compliance'],
      },
      {
        title: 'Refresh cadence',
        description: 'Hourly vs daily jobs per dataset.',
        priority: 'low',
        tags: ['Pipelines'],
      },
    ],
    progress: [
      {
        title: 'dbt staging models',
        description: 'Normalize raw events into staging tables.',
        priority: 'high',
        dueDate: '2024-02-23',
        tags: ['dbt', 'SQL'],
      },
      {
        title: 'Looker dashboard v1',
        description: 'Funnel and cohort charts for product.',
        priority: 'high',
        tags: ['BI'],
      },
      {
        title: 'Anomaly detection job',
        description: 'Threshold alerts on daily active users.',
        priority: 'medium',
        tags: ['Monitoring'],
      },
    ],
    review: [
      {
        title: 'Metric definitions sign-off',
        description: 'Stakeholders approve formulas.',
        priority: 'medium',
        tags: ['Governance'],
      },
      {
        title: 'Row-level security test',
        description: 'Validate filters per team in the BI tool.',
        priority: 'high',
        tags: ['Security'],
      },
      {
        title: 'Data quality checks',
        description: 'Null rates and freshness SLAs.',
        priority: 'medium',
        tags: ['QA'],
      },
    ],
    done: [
      {
        title: 'Historical backfill complete',
        description: '12 months of orders loaded.',
        priority: 'low',
        tags: ['ETL'],
      },
      {
        title: 'Executive summary automated',
        description: 'Weekly email with key KPIs.',
        priority: 'low',
        tags: ['Reporting'],
      },
      {
        title: 'Dictionary published',
        description: 'Business glossary in the wiki.',
        priority: 'low',
        tags: ['Docs'],
      },
    ],
  },
  // 3 — Internal tools / admin
  {
    todo: [
      {
        title: 'Role matrix',
        description: 'Which roles can approve refunds and edits.',
        priority: 'high',
        tags: ['RBAC', 'Spec'],
      },
      {
        title: 'Audit log requirements',
        description: 'Fields to capture for every admin action.',
        priority: 'medium',
        tags: ['Compliance'],
      },
      {
        title: 'Bulk import UX',
        description: 'CSV mapping and error reporting.',
        priority: 'medium',
        tags: ['UX'],
      },
      {
        title: 'Help sidebar content',
        description: 'Short docs for each admin screen.',
        priority: 'low',
        tags: ['Docs'],
      },
    ],
    progress: [
      {
        title: 'Admin table filters',
        description: 'Persisted filters and saved views.',
        priority: 'high',
        dueDate: '2024-02-19',
        tags: ['Frontend'],
      },
      {
        title: 'Approval workflow engine',
        description: 'States, transitions, and notifications.',
        priority: 'high',
        tags: ['Backend'],
      },
      {
        title: 'Impersonation mode',
        description: 'Support-only session with banner and logging.',
        priority: 'medium',
        tags: ['Security'],
      },
    ],
    review: [
      {
        title: 'SOC2 control mapping',
        description: 'Map features to control checklist.',
        priority: 'medium',
        tags: ['Compliance'],
      },
      {
        title: 'Keyboard shortcuts review',
        description: 'No conflicts with browser or OS.',
        priority: 'low',
        tags: ['A11y'],
      },
      {
        title: 'Load test admin APIs',
        description: 'Bulk endpoints under concurrent admins.',
        priority: 'medium',
        tags: ['QA'],
      },
    ],
    done: [
      {
        title: 'Internal SSO rollout',
        description: 'Company IdP connected for all staff.',
        priority: 'low',
        tags: ['Auth'],
      },
      {
        title: 'Feature flags for admin',
        description: 'Gradual rollout of new panels.',
        priority: 'low',
        tags: ['Ops'],
      },
      {
        title: 'Runbook for incidents',
        description: 'On-call steps for outages.',
        priority: 'low',
        tags: ['Docs'],
      },
    ],
  },
  // 4 — Marketing / content
  {
    todo: [
      {
        title: 'Campaign brief',
        description: 'Audience, offer, and success metrics.',
        priority: 'high',
        dueDate: '2024-02-14',
        tags: ['Campaign'],
      },
      {
        title: 'Blog calendar Q1',
        description: 'Topics and owners for each week.',
        priority: 'medium',
        tags: ['Content'],
      },
      {
        title: 'Social asset pack',
        description: 'Sizes and formats per channel.',
        priority: 'low',
        tags: ['Design'],
      },
      {
        title: 'Landing page experiment',
        description: 'Hypothesis and variants for A/B.',
        priority: 'medium',
        tags: ['Growth'],
      },
    ],
    progress: [
      {
        title: 'Email drip sequence',
        description: '3-email nurture with dynamic fields.',
        priority: 'high',
        tags: ['Email'],
      },
      {
        title: 'Webinar recording edit',
        description: 'Cuts, captions, and chapter markers.',
        priority: 'medium',
        tags: ['Video'],
      },
      {
        title: 'Paid ads creative rotation',
        description: 'Upload new sets and pause underperformers.',
        priority: 'high',
        tags: ['Ads'],
      },
    ],
    review: [
      {
        title: 'Brand voice check',
        description: 'Tone consistency across new pages.',
        priority: 'medium',
        tags: ['Brand'],
      },
      {
        title: 'Legal disclaimer on promo',
        description: 'Terms and eligibility copy.',
        priority: 'high',
        tags: ['Legal'],
      },
      {
        title: 'UTM hygiene audit',
        description: 'Naming and channel coverage.',
        priority: 'low',
        tags: ['Analytics'],
      },
    ],
    done: [
      {
        title: 'Newsletter launch',
        description: 'First send completed with 32% open rate.',
        priority: 'low',
        tags: ['Email'],
      },
      {
        title: 'Case study published',
        description: 'Customer story with metrics.',
        priority: 'low',
        tags: ['Content'],
      },
      {
        title: 'Press kit updated',
        description: 'Logos and boilerplate.',
        priority: 'low',
        tags: ['PR'],
      },
    ],
  },
  // 5 — DevOps / platform
  {
    todo: [
      {
        title: 'SLOs for core APIs',
        description: 'Latency and error budgets for tier-1 services.',
        priority: 'high',
        tags: ['SRE'],
      },
      {
        title: 'Secrets rotation plan',
        description: 'Order and blast radius for key rotation.',
        priority: 'high',
        tags: ['Security'],
      },
      {
        title: 'Cost allocation tags',
        description: 'Tag strategy for multi-team billing.',
        priority: 'medium',
        tags: ['Cloud'],
      },
      {
        title: 'Runbook for deploy freeze',
        description: 'Who approves exceptions during holidays.',
        priority: 'low',
        tags: ['Process'],
      },
    ],
    progress: [
      {
        title: 'Kubernetes rollout',
        description: 'Canary deployment for payment service.',
        priority: 'high',
        dueDate: '2024-02-24',
        tags: ['K8s'],
      },
      {
        title: 'Terraform module refactor',
        description: 'Shared modules for VPC and subnets.',
        priority: 'medium',
        tags: ['IaC'],
      },
      {
        title: 'Centralized logging',
        description: 'Ship app logs to the aggregator with retention.',
        priority: 'high',
        tags: ['Observability'],
      },
    ],
    review: [
      {
        title: 'DR drill dry run',
        description: 'Failover database and restore checklist.',
        priority: 'high',
        tags: ['DR'],
      },
      {
        title: 'Container image scan',
        description: 'CVE thresholds and base image policy.',
        priority: 'medium',
        tags: ['Security'],
      },
      {
        title: 'Capacity planning review',
        description: 'CPU headroom for Q2 traffic spike.',
        priority: 'medium',
        tags: ['Capacity'],
      },
    ],
    done: [
      {
        title: 'CI pipeline < 12 min',
        description: 'Test parallelization and caching.',
        priority: 'low',
        tags: ['CI'],
      },
      {
        title: 'On-call rotation updated',
        description: 'New hires added to PagerDuty.',
        priority: 'low',
        tags: ['Ops'],
      },
      {
        title: 'Backup verification',
        description: 'Monthly restore test passed.',
        priority: 'low',
        tags: ['Backup'],
      },
    ],
  },
];

function mapColumn(
  colId: 'todo' | 'progress' | 'review' | 'done',
  title: string,
  color: string,
  seeds: TaskSeed[],
  tid: (suffix: string) => string,
  assigneeName: string,
  createdByUserId: string,
) {
  const prefix =
    colId === 'todo' ? 'todo' : colId === 'progress' ? 'prog' : colId === 'review' ? 'rev' : 'done';
  return {
    id: colId,
    title,
    color,
    tasks: seeds.map((s, i) => ({
      id: tid(`${prefix}-${i + 1}`),
      title: s.title,
      description: s.description,
      priority: s.priority,
      assignee: assigneeName,
      createdBy: createdByUserId,
      dueDate: s.dueDate,
      tags: s.tags,
    })),
  };
}

export function buildDemoBoardColumns(assigneeName: string, userId: string) {
  const tid = (suffix: string) => `demo-${userId}-${suffix}`;
  const idx = templateIndexForUser(userId, TEMPLATES.length);
  const t = TEMPLATES[idx];

  return [
    mapColumn('todo', 'To Do', 'bg-blue-500', t.todo, tid, assigneeName, userId),
    mapColumn('progress', 'In Progress', 'bg-yellow-500', t.progress, tid, assigneeName, userId),
    mapColumn('review', 'Review', 'bg-purple-500', t.review, tid, assigneeName, userId),
    mapColumn('done', 'Done', 'bg-green-500', t.done, tid, assigneeName, userId),
  ];
}
