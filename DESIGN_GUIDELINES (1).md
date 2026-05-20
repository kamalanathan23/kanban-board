# Design Guidelines

This document outlines the design system used across the Sales, Finance, and Projects screens in the Xone application.

## Table of Contents
1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Border Radius](#border-radius)
4. [Boxes & Cards](#boxes--cards)
5. [Buttons](#buttons)
6. [Badges & Tags](#badges--tags)
7. [Spacing](#spacing)
8. [Shadows](#shadows)
9. [Icons](#icons)
10. [Status Indicators](#status-indicators)
11. [Form Elements](#form-elements)
12. [Layout Patterns](#layout-patterns)

---

## Color Palette

### Primary Colors
- **Primary Green**: `#249E5E`
  - Used for: Primary buttons, active states, links, icons, progress indicators
  - Hover: `#1f8750`
  - Background tint: `bg-emerald-50` (for icon containers)
  - Text on primary: `text-white`

### Text Colors
- **Headings**: `#0F172A` (text-gray-900)
- **Subtitles**: `#475569` (text-gray-600)
- **Body Text**: `#64748B` (text-gray-500)
- **Muted Text**: `text-gray-400` or `text-gray-500`

### Background Colors
- **White**: `bg-white` (default card/container background)
- **Gray-50**: `bg-gray-50` (subtle backgrounds, form inputs)
- **Gray-100**: `bg-gray-100` (tab containers, inactive states)
- **Gray-200**: `bg-gray-200` (borders, dividers)

### Status Colors
- **Success/Approved**: 
  - Background: `bg-emerald-50`
  - Text: `text-emerald-700`
  - Border: `border-emerald-100`
  - Icon: `text-[#249E5E]`

- **Error/Rejected**: 
  - Background: `bg-red-50`
  - Text: `text-red-700`
  - Border: `border-red-100`
  - Icon: `text-red-500`

- **Pending/Warning**: 
  - Background: `bg-orange-50` or `bg-yellow-50`
  - Text: `text-orange-700` or `text-yellow-700`
  - Border: `border-orange-100`

- **Neutral/Inactive**: 
  - Background: `bg-gray-50` or `bg-gray-100`
  - Text: `text-gray-600` or `text-gray-700`
  - Border: `border-gray-200`

### Accent Colors
- **Blue**: `bg-blue-50`, `text-blue-700`, `border-blue-100`
- **Purple**: `bg-purple-50`, `text-purple-700`, `border-purple-100`
- **Orange**: `bg-orange-50`, `text-orange-700`, `border-orange-100`

### Special Colors
- **Tooltip Background**: `bg-gray-900` with `text-white`
- **Loading Spinner**: `border-[#249E5E]`

---

## Typography

### Headings
- **Page Title**: 
  - Size: `text-[28px]`
  - Weight: `font-bold`
  - Line Height: `leading-[34px]`
  - Color: `text-[#0F172A]`

- **Card Title**: 
  - Size: `text-lg` or `text-xl`
  - Weight: `font-bold` or `font-semibold`
  - Color: `text-gray-900`

- **Section Title**: 
  - Size: `text-base` or `text-lg`
  - Weight: `font-semibold`
  - Color: `text-gray-900`

### Body Text
- **Subtitle**: 
  - Size: `text-sm`
  - Color: `text-[#475569]` or `text-gray-500`
  - Margin: `mt-1`

- **Body**: 
  - Size: `text-sm` or `text-base`
  - Color: `text-gray-600` or `text-[#64748B]`

- **Small Text**: 
  - Size: `text-xs`
  - Color: `text-gray-500` or `text-gray-400`

### Special Typography
- **Breadcrumb/Context Label**: 
  - Size: `text-xs`
  - Weight: `font-semibold`
  - Color: `text-[#249E5E]`
  - Transform: `uppercase`
  - Tracking: `tracking-wider`

- **Numbers/Metrics**: 
  - Size: `text-4xl` or `text-3xl`
  - Weight: `font-bold`
  - Color: `text-gray-900` or `text-[#249E5E]`

---

## Border Radius

### Standard Radius Values
- **Small**: `rounded-sm` (2px) - for small badges
- **Medium**: `rounded-md` (6px) - for badges, small elements
- **Default**: `rounded-lg` (8px) - for buttons, inputs, cards
- **Large**: `rounded-xl` (12px) - for cards, containers, tabs
- **Extra Large**: `rounded-2xl` (16px) - for large cards, modals
- **Custom**: `rounded-[10px]` (10px) - for buttons, inputs
- **Custom**: `rounded-[12px]` (12px) - for cards
- **Full Circle**: `rounded-full` - for avatars, icons, status dots

### Usage Guidelines
- **Cards**: `rounded-xl` or `rounded-[12px]`
- **Buttons**: `rounded-[10px]` or `rounded-lg`
- **Inputs**: `rounded-lg`
- **Badges**: `rounded-md` or `rounded-full`
- **Icon Containers**: `rounded-full`
- **Tabs Container**: `rounded-xl`

---

## Boxes & Cards

### Standard Card
```tsx
className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
```
or
```tsx
className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_6px_20px_rgba(16,24,40,0.06)] p-4"
```

### Card Variants
- **Default Card**: 
  - Background: `bg-white`
  - Border: `border border-gray-200`
  - Radius: `rounded-xl` or `rounded-[12px]`
  - Shadow: `shadow-sm`
  - Padding: `p-4`, `p-5`, or `p-6`

- **Hoverable Card**: 
  - Add: `hover:shadow-md transition-shadow cursor-pointer`

- **Selected Card**: 
  - Border: `border-[#249E5E]`
  - Background: `bg-green-50/10` or `bg-emerald-50`

- **Info Card**: 
  - Background: `bg-gray-50` or `bg-blue-50`
  - Border: `border-gray-200` or `border-blue-100`
  - Padding: `p-3` or `p-4`
  - Radius: `rounded-lg`

### Container Boxes
- **Tab Container**: 
  - Background: `bg-gray-100`
  - Border: `border border-gray-200`
  - Padding: `p-1.5`
  - Radius: `rounded-xl`
  - Shadow: `shadow-inner`

- **Filter Container**: 
  - Background: `bg-white`
  - Border: `border border-gray-200`
  - Padding: `p-4` or `p-5`
  - Radius: `rounded-lg`
  - Shadow: `shadow-sm`

---

## Buttons

### Primary Button
```tsx
className="bg-[#249E5E] hover:bg-[#1f8750] text-white border-none shadow-sm h-10 px-4 rounded-[10px] inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm"
```

**Characteristics:**
- Background: `bg-[#249E5E]`
- Hover: `hover:bg-[#1f8750]`
- Text: `text-white`
- Height: `h-10` (40px) or `h-8` (32px) for smaller buttons
- Padding: `px-4` (horizontal), `px-3` for smaller
- Radius: `rounded-[10px]`
- Shadow: `shadow-sm`
- Font: `font-medium`
- Size: `text-sm`

### Secondary Button
```tsx
className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 h-10 px-4 rounded-[10px] inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm"
```

**Characteristics:**
- Background: `bg-white`
- Border: `border border-gray-200`
- Text: `text-gray-700`
- Hover: `hover:bg-gray-50`
- Same dimensions and styling as primary

### Icon Button
```tsx
className="w-8 h-8 p-0 flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
```

### Button Sizes
- **Small**: `h-8 px-3 text-sm`
- **Medium**: `h-10 px-4 text-sm` (default)
- **Large**: `h-12 px-6 text-base`

---

## Badges & Tags

### Status Badge
```tsx
className="px-2.5 py-0.5 rounded text-xs font-medium"
```

### Colored Badges
- **Emerald (Success)**: 
  - `bg-emerald-50 text-emerald-700 border border-emerald-100`

- **Blue**: 
  - `bg-blue-50 text-blue-700 border border-blue-100`

- **Purple**: 
  - `bg-purple-50 text-purple-700 border border-purple-100`

- **Orange**: 
  - `bg-orange-50 text-orange-700 border border-orange-100`

- **Gray**: 
  - `bg-gray-100 text-gray-600` or `bg-gray-50 text-gray-700`

### Badge Sizes
- **Small**: `px-2 py-1 text-xs`
- **Medium**: `px-2.5 py-0.5 text-xs`
- **Large**: `px-3 py-1 text-sm`

### Rounded Badges
- **Pill**: `rounded-full` (for status indicators)
- **Default**: `rounded-md` or `rounded`

---

## Spacing

### Padding
- **Extra Small**: `p-2` (8px)
- **Small**: `p-3` (12px)
- **Medium**: `p-4` (16px) - most common
- **Large**: `p-5` (20px)
- **Extra Large**: `p-6` (24px)

### Margin
- **Extra Small**: `mb-2` or `mt-2` (8px)
- **Small**: `mb-3` or `mt-3` (12px)
- **Medium**: `mb-4` or `mt-4` (16px)
- **Large**: `mb-6` or `mt-6` (24px)
- **Extra Large**: `mb-8` or `mt-8` (32px)

### Gap (for flex/grid)
- **Small**: `gap-2` (8px)
- **Medium**: `gap-3` (12px) or `gap-4` (16px)
- **Large**: `gap-6` (24px)

---

## Shadows

### Shadow Levels
- **None**: No shadow (default for most elements)
- **Small**: `shadow-sm` - subtle elevation
- **Medium**: `shadow-md` - cards on hover, active buttons
- **Custom**: `shadow-[0_6px_20px_rgba(16,24,40,0.06)]` - for cards
- **Button Shadow**: `shadow-md shadow-emerald-900/20` - for active tab buttons

### Usage
- **Cards**: `shadow-sm` (default), `shadow-md` (hover)
- **Buttons**: `shadow-sm` (default), `shadow-md` (active/primary)
- **Tooltips**: `shadow-xl`
- **Modals/Sheets**: `shadow-lg` or `shadow-xl`

---

## Icons

### Icon Containers
- **Circular Background**: 
  - Size: `w-12 h-12` (48px) or `w-10 h-10` (40px)
  - Background: `bg-emerald-50` or `bg-gray-100`
  - Icon Color: `text-[#249E5E]` or `text-gray-600`
  - Radius: `rounded-full`
  - Display: `flex items-center justify-center`

- **Square Background**: 
  - Size: `w-8 h-8` or `w-10 h-10`
  - Background: `bg-white` or `bg-gray-50`
  - Radius: `rounded-lg`
  - Border: `border border-gray-200` (optional)

### Icon Sizes
- **Small**: `w-4 h-4` (16px)
- **Medium**: `w-5 h-5` (20px)
- **Large**: `w-6 h-6` (24px)
- **Extra Large**: `w-8 h-8` (32px)

---

## Status Indicators

### Status Dots
- **Size**: `w-2 h-2` (8px) or `w-3 h-3` (12px) or `w-4 h-4` (16px)
- **Shape**: `rounded-full`
- **Colors**: 
  - Active: `bg-[#249E5E]`
  - Inactive: `bg-gray-500`
  - Error: `bg-red-500`
  - Warning: `bg-orange-500` or `bg-yellow-500`

### Progress Indicators
- **Progress Bar**: 
  - Background: `bg-gray-200` or `bg-gray-100`
  - Fill: `bg-[#249E5E]`
  - Radius: `rounded-full`
  - Height: `h-2` or `h-3`

- **Circular Progress**: 
  - Border: `border-[#249E5E]`
  - Animation: `animate-spin`
  - Size: `h-8 w-8`

### Status Boxes
- **Approved**: 
  - `bg-emerald-50 border border-emerald-100 rounded-lg p-4`
  - Dot: `bg-[#249E5E]`

- **Pending**: 
  - `bg-gray-50 border border-gray-200 rounded-lg p-4`
  - Dot: `bg-gray-500`

- **Rejected**: 
  - `bg-red-50 border border-red-100 rounded-lg p-4`
  - Dot: `bg-red-500`

---

## Form Elements

### Input Fields
```tsx
className="pl-10 pr-4 h-10 w-full text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249E5E] transition-all shadow-sm"
```

**Characteristics:**
- Height: `h-10` (40px)
- Background: `bg-white`
- Border: `border border-gray-200`
- Radius: `rounded-lg`
- Focus: `focus:ring-2 focus:ring-[#249E5E]`
- Shadow: `shadow-sm`
- Padding: `pl-10 pr-4` (with icon) or `px-3` (without)

### Textarea
```tsx
className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 focus:outline-none focus:ring-[#249E5E] focus:border-[#249E5E] focus:bg-white"
```

### Select/Dropdown
- Same styling as input fields
- Trigger: `border border-gray-200 rounded-lg`
- Content: `bg-white border border-gray-200 rounded-lg shadow-lg`

### Labels
- Size: `text-sm`
- Weight: `font-medium` or `font-semibold`
- Color: `text-gray-700` or `text-gray-900`

---

## Layout Patterns

### Grid Layouts
- **Stats Cards**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- **Two Column**: `grid grid-cols-1 lg:grid-cols-2 gap-6`
- **Three Column**: `grid grid-cols-1 md:grid-cols-3 gap-6`
- **Twelve Column**: `grid grid-cols-1 lg:grid-cols-12 gap-6`

### Flex Layouts
- **Row**: `flex flex-row items-center gap-4`
- **Column**: `flex flex-col gap-4` or `gap-6`
- **Space Between**: `flex justify-between items-center`
- **Center**: `flex items-center justify-center`

### Page Structure
```tsx
<div className="flex flex-col">
  <PageHeader />
  <div className="mb-6">
    <Tabs />
  </div>
  <div className="mt-6">
    {/* Content */}
  </div>
</div>
```

### Card Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card>...</Card>
</div>
```

---

## Component-Specific Patterns

### Tabs
- **Container**: `bg-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-inner`
- **Tab Button**: 
  - Active: `bg-[#249E5E] text-white shadow-md shadow-emerald-900/20`
  - Inactive: `text-gray-500 hover:text-gray-900 hover:bg-white/60`
  - Padding: `px-6 py-2.5`
  - Radius: `rounded-lg`
  - Font: `text-sm font-semibold`

### Search Bar
- Container: `relative`
- Input: Standard input styling with `pl-10` for icon
- Icon: `absolute left-3 top-1/2 -translate-y-1/2`

### Filter Chips
- Display: `inline-flex items-center gap-1`
- Padding: `px-2 py-1`
- Radius: `rounded-md`
- Background: Color-coded based on filter type
- Border: Matching color border

### Table Rows
- Hover: `hover:bg-gray-50`
- Border: `border-b border-gray-200`
- Padding: `px-6 py-4`

### Loading States
- Spinner: `animate-spin rounded-full h-8 w-8 border-b-2 border-[#249E5E]`
- Container: Center with `flex items-center justify-center`

### Empty States
- Container: `text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50`
- Icon: Large, muted color
- Text: `text-gray-500` or `text-muted-foreground`

---

## Animation & Transitions

### Transitions
- **Default**: `transition-all duration-200 ease-in-out`
- **Colors**: `transition-colors`
- **Shadow**: `transition-shadow`
- **Opacity**: `transition-opacity`

### Animations
- **Fade In**: `animate-in fade-in slide-in-from-bottom-4 duration-500`
- **Spin**: `animate-spin` (for loaders)
- **Hover Effects**: Smooth color and shadow transitions

---

## Accessibility

### Focus States
- **Ring**: `focus:ring-2 focus:ring-[#249E5E] focus:ring-offset-2`
- **Outline**: `focus:outline-none` (replaced by ring)

### Disabled States
- **Opacity**: `disabled:opacity-50`
- **Cursor**: `disabled:cursor-not-allowed`
- **Pointer Events**: `disabled:pointer-events-none`

---

## Best Practices

1. **Consistency**: Use the same color values, spacing, and radius across similar components
2. **Hierarchy**: Use appropriate text sizes and weights to establish visual hierarchy
3. **Spacing**: Maintain consistent spacing using the defined scale
4. **Colors**: Use semantic color names (success, error, warning) rather than arbitrary colors
5. **Responsive**: Ensure components work across all breakpoints (mobile, tablet, desktop)
6. **Accessibility**: Always include proper focus states and ARIA labels
7. **Performance**: Use CSS transitions instead of JavaScript animations when possible

---

## Examples

### Complete Card Example
```tsx
<Card className="p-6">
  <div className="flex justify-between items-start mb-4">
    <div>
      <h3 className="text-lg font-bold text-gray-900">Card Title</h3>
      <p className="text-sm text-gray-500 mt-1">Card subtitle</p>
    </div>
    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-[#249E5E]">
      <Icon size={24} />
    </div>
  </div>
  <div className="mt-4">
    <Button className="bg-[#249E5E] hover:bg-[#1f8750] text-white rounded-[10px]">
      Action
    </Button>
  </div>
</Card>
```

### Status Badge Example
```tsx
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
  Approved
</span>
```

---

*Last Updated: Based on Sales, Finance, and Projects screens analysis*

