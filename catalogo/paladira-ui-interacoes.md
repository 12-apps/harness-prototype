# @12-apps/ui — fiação exigida por componente

Gerado do catálogo (128 componentes), com verificação de cobertura total.

Um componente não é passivo por natureza, e sim por uso: Avatar abre menu,
Card inteiro vira alvo de clique, Badge se descarta. Por isso são três níveis,
e a auditoria do harness decide pelo que a tela oferece (role, tabindex,
onclick, cursor:pointer, data-act), não pelo nome do componente.

| nível | significado | n |
|---|---|---|
| `exige` | existe para ser operado — sem passo, é buraco na especificação | 60 |
| `pode` | só é interativo quando recebe handler — exige passo SE a tela mostrar afordância | 37 |
| `nunca` | não há o que operar | 31 |

## exige

| componente | passo | import |
|---|---|---|
| `Accordion` | `alterna` | `@12-apps/ui/layout/Accordion` |
| `AddressAutocomplete` | `preenche` | `@12-apps/ui/form/AddressAutocomplete` |
| `AlertDialog` | `clique` | `@12-apps/ui/data-display/AlertDialog` |
| `Autocomplete` | `preenche` | `@12-apps/ui/form/Autocomplete` |
| `Breadcrumbs` | `clique/preenche` | `@12-apps/ui/navigation/Breadcrumbs` |
| `Button` | `clique` | `@12-apps/ui/form/Button` |
| `Calendar` | `escolhe` | `@12-apps/ui/form/Calendar` |
| `Carousel` | `clique/preenche` | `@12-apps/ui/data-display/Carousel` |
| `CategorySelect` | `escolhe` | `@12-apps/ui/form/CategorySelect` |
| `CepField` | `preenche` | `@12-apps/ui/form/CepField` |
| `Checkbox` | `alterna` | `@12-apps/ui/form/Checkbox` |
| `CodeEditor` | `preenche` | `@12-apps/ui/form/CodeEditor` |
| `Collapsible` | `alterna` | `@12-apps/ui/layout/Collapsible` |
| `Command` | `preenche` | `@12-apps/ui/form/Command` |
| `CommandPalette` | `preenche` | `@12-apps/ui/navigation/CommandPalette` |
| `ConfirmAction` | `clique` | `@12-apps/ui/feedback/ConfirmAction` |
| `ContextMenu` | `clique` | `@12-apps/ui/navigation/ContextMenu` |
| `CreatableSelect` | `preenche` | `@12-apps/ui/form/CreatableSelect` |
| `DataGrid` | `clique/preenche` | `@12-apps/ui/data-display/DataGrid` |
| `DataViews` | `escolhe` | `@12-apps/ui/data-display/DataViews` |
| `DateRangePicker` | `escolhe` | `@12-apps/ui/form/DateRangePicker` |
| `Dialog` | `clique` | `@12-apps/ui/feedback/Dialog` |
| `Drawer` | `clique` | `@12-apps/ui/layout/Drawer` |
| `DropdownMenu` | `clique` | `@12-apps/ui/navigation/DropdownMenu` |
| `Form` | `clique/preenche` | `@12-apps/ui/form/Form` |
| `HeaderButton` | `clique` | `@12-apps/ui/form/HeaderButton` |
| `Input` | `preenche` | `@12-apps/ui/form/Input` |
| `InputOTP` | `preenche` | `@12-apps/ui/form/InputOTP` |
| `InstallPrompt` | `clique` | `@12-apps/ui/utility/InstallPrompt` |
| `Lightbox` | `clique` | `@12-apps/ui/data-display/Lightbox` |
| `Link` | `clique/preenche` | `@12-apps/ui/mui/Link` |
| `ListItemButton` | `clique/preenche` | `@12-apps/ui/mui/ListItemButton` |
| `Menubar` | `clique` | `@12-apps/ui/form/Menubar` |
| `Modal` | `clique` | `@12-apps/ui/feedback/Modal` |
| `NavigationMenu` | `clique` | `@12-apps/ui/navigation/NavigationMenu` |
| `Pagination` | `escolhe` | `@12-apps/ui/navigation/Pagination` |
| `PasswordStrength` | `preenche` | `@12-apps/ui/form/PasswordStrength` |
| `PhoneInput` | `preenche` | `@12-apps/ui/form/PhoneInput` |
| `Popover` | `clique` | `@12-apps/ui/data-display/Popover` |
| `RadioGroup` | `escolhe` | `@12-apps/ui/form/RadioGroup` |
| `Resizable` | `clique/preenche` | `@12-apps/ui/layout/Resizable` |
| `RichTextEditor` | `preenche` | `@12-apps/ui/form/RichTextEditor` |
| `SearchPalette` | `preenche` | `@12-apps/ui/form/SearchPalette` |
| `Select` | `escolhe` | `@12-apps/ui/form/Select` |
| `Sheet` | `clique` | `@12-apps/ui/data-display/Sheet` |
| `Sidebar` | `clique/preenche` | `@12-apps/ui/layout/Sidebar` |
| `Slider` | `escolhe` | `@12-apps/ui/form/Slider` |
| `StackedModal` | `clique` | `@12-apps/ui/feedback/StackedModal` |
| `Stepper` | `clique` | `@12-apps/ui/data-display/Stepper` |
| `Switch` | `alterna` | `@12-apps/ui/form/Switch` |
| `TableFilter` | `escolhe` | `@12-apps/ui/layout/TableFilter` |
| `Tabs` | `escolhe` | `@12-apps/ui/navigation/Tabs` |
| `Textarea` | `preenche` | `@12-apps/ui/form/Textarea` |
| `Toggle` | `alterna` | `@12-apps/ui/form/Toggle` |
| `ToggleGroup` | `escolhe` | `@12-apps/ui/form/ToggleGroup` |
| `TutorialOverlay` | `clique` | `@12-apps/ui/feedback/TutorialOverlay` |
| `UploadButton` | `clique` | `@12-apps/ui/form/UploadButton` |
| `button` | `clique` | `@12-apps/ui/button` |
| `social-login-button` | `clique` | `@12-apps/ui/social-login-button` |
| `total-form` | `clique/preenche` | `@12-apps/ui/form/total-form` |

## pode

| componente | passo | import |
|---|---|---|
| `Alert` | `—` | `@12-apps/ui/data-display/Alert` |
| `AnimatedIcon` | `—` | `@12-apps/ui/utility/AnimatedIcon` |
| `AppHeader` | `clique/preenche` | `@12-apps/ui/navigation/AppHeader` |
| `Avatar` | `—` | `@12-apps/ui/data-display/Avatar` |
| `Badge` | `—` | `@12-apps/ui/data-display/Badge` |
| `Banner` | `—` | `@12-apps/ui/data-display/Banner` |
| `Card` | `—` | `@12-apps/ui/layout/Card` |
| `CardGrid` | `—` | `@12-apps/ui/layout/CardGrid` |
| `Chart` | `—` | `@12-apps/ui/data-display/Chart` |
| `Chip` | `clique` | `@12-apps/ui/data-display/Chip` |
| `Container` | `—` | `@12-apps/ui/layout/Container` |
| `ContentToolbar` | `clique/preenche` | `@12-apps/ui/layout/ContentToolbar` |
| `Dashboard` | `clique/preenche` | `@12-apps/ui/layout/Dashboard` |
| `DescriptionItem` | `—` | `@12-apps/ui/data-display/DescriptionItem` |
| `EmptyState` | `—` | `@12-apps/ui/data-display/EmptyState` |
| `ErrorState` | `—` | `@12-apps/ui/data-display/ErrorState` |
| `HoverCard` | `clique` | `@12-apps/ui/data-display/HoverCard` |
| `InfiniteScroll` | `clique/preenche` | `@12-apps/ui/utility/InfiniteScroll` |
| `InteractiveTooltip` | `clique` | `@12-apps/ui/data-display/InteractiveTooltip` |
| `LazyImage` | `—` | `@12-apps/ui/data-display/LazyImage` |
| `ListItem` | `—` | `@12-apps/ui/mui/ListItem` |
| `MapPreview` | `clique/preenche` | `@12-apps/ui/data-display/MapPreview` |
| `Overflow` | `—` | `@12-apps/ui/utility/Overflow` |
| `Progress` | `—` | `@12-apps/ui/data-display/Progress` |
| `ScrollArea` | `—` | `@12-apps/ui/layout/ScrollArea` |
| `SectionOnboarding` | `clique` | `@12-apps/ui/data-display/SectionOnboarding` |
| `SettingsLayout` | `clique/preenche` | `@12-apps/ui/layout/SettingsLayout` |
| `Sonner` | `—` | `@12-apps/ui/feedback/Sonner` |
| `StatCard` | `—` | `@12-apps/ui/data-display/StatCard` |
| `Table` | `clique/preenche` | `@12-apps/ui/data-display/Table` |
| `Timeline` | `—` | `@12-apps/ui/data-display/Timeline` |
| `Toast` | `—` | `@12-apps/ui/feedback/Toast` |
| `Tooltip` | `clique` | `@12-apps/ui/data-display/Tooltip` |
| `VirtualList` | `clique/preenche` | `@12-apps/ui/utility/VirtualList` |
| `WorkflowStep` | `clique` | `@12-apps/ui/utility/WorkflowStep` |
| `charts` | `—` | `@12-apps/ui/charts` |
| `user-avatar` | `—` | `@12-apps/ui/user-avatar` |

## nunca

| componente | import |
|---|---|
| `AppBar` | `@12-apps/ui/mui/AppBar` |
| `AspectRatio` | `@12-apps/ui/utility/AspectRatio` |
| `AsyncStateContainer` | `@12-apps/ui/data-display/AsyncStateContainer` |
| `Blockquote` | `@12-apps/ui/typography/Blockquote` |
| `Box` | `@12-apps/ui/mui/Box` |
| `Code` | `@12-apps/ui/typography/Code` |
| `CssBaseline` | `@12-apps/ui/mui/CssBaseline` |
| `FormControl` | `@12-apps/ui/mui/FormControl` |
| `FormControlLabel` | `@12-apps/ui/mui/FormControlLabel` |
| `Grid2` | `@12-apps/ui/mui/Grid2` |
| `Heading` | `@12-apps/ui/typography/Heading` |
| `InputLabel` | `@12-apps/ui/mui/InputLabel` |
| `Label` | `@12-apps/ui/form/Label` |
| `List` | `@12-apps/ui/mui/List` |
| `ListItemText` | `@12-apps/ui/mui/ListItemText` |
| `LoadingState` | `@12-apps/ui/data-display/LoadingState` |
| `Paragraph` | `@12-apps/ui/typography/Paragraph` |
| `Portal` | `@12-apps/ui/utility/Portal` |
| `Separator` | `@12-apps/ui/layout/Separator` |
| `Skeleton` | `@12-apps/ui/layout/Skeleton` |
| `Spacer` | `@12-apps/ui/layout/Spacer` |
| `Stack` | `@12-apps/ui/mui/Stack` |
| `SvgIcon` | `@12-apps/ui/mui/SvgIcon` |
| `Text` | `@12-apps/ui/typography/Text` |
| `TimingDiagram` | `@12-apps/ui/data-display/TimingDiagram` |
| `Toolbar` | `@12-apps/ui/mui/Toolbar` |
| `Transition` | `@12-apps/ui/utility/Transition` |
| `styles` | `@12-apps/ui/mui/styles` |
| `tokens` | `@12-apps/ui/tokens` |
| `useMediaQuery` | `@12-apps/ui/mui/useMediaQuery` |
| `utils` | `@12-apps/ui/utils` |
