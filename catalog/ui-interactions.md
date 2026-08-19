# @12-apps/ui — wiring required per component

All 210 components in the catalog are classified. Each level was read off the
component's own declaration in the package source: a part that always renders a
`Button`, a `ListItemButton` or an `onClick` is `exige`; a part that only
takes a handler is `pode`; a container, a context provider or an icon is
`nunca`.

A component is not passive by nature, but by use: an Avatar opens a menu, a
whole Card becomes a click target, a Badge gets dismissed. Hence three levels,
and only the first is decided here.

**`exige` is enforced.** The gate reads `ui-interactions.js` and rejects a
prototype that renders an `exige` component with nothing to operate — no
`data-act`, no `data-campo`, no `on…` prop, no `href` — before a browser
starts. Moving a component in or out of `exige` changes what the gate accepts.

`pode` and `nunca` are not checked in the source. `pode` depends on what the
screen actually offers, which the runtime audit decides from the rendered DOM
(role, tabindex, onclick, cursor:pointer, data-act) rather than from the
component's name; `nunca` has nothing to demand.

The three level names stay Portuguese, matching the values in
`ui-interactions.js`: `exige` = always operable, `pode` = operable if
given a handler, `nunca` = inert.

| nível | significado | n |
|---|---|---|
| `exige` | existe para ser operado — sem passo, é buraco na especificação | 85 |
| `pode` | só é interativo quando recebe handler — exige passo SE a tela mostrar afordância | 51 |
| `nunca` | não há o que operar | 74 |

## exige

| componente | passo | import |
|---|---|---|
| `Accordion` | `alterna` | `@12-apps/ui/layout/Accordion` |
| `AccordionSummary` | `alterna` | `@12-apps/ui/layout/Accordion` |
| `AddressAutocomplete` | `preenche` | `@12-apps/ui/form/AddressAutocomplete` |
| `AlertDialog` | `clique` | `@12-apps/ui/data-display/AlertDialog` |
| `AppHeaderDetails` | `clique` | `@12-apps/ui/navigation/AppHeader` |
| `Autocomplete` | `preenche` | `@12-apps/ui/form/Autocomplete` |
| `Breadcrumbs` | `clique/preenche` | `@12-apps/ui/navigation/Breadcrumbs` |
| `Button` | `clique` | `@12-apps/ui/form/Button` |
| `Calendar` | `escolhe` | `@12-apps/ui/form/Calendar` |
| `Carousel` | `clique/preenche` | `@12-apps/ui/data-display/Carousel` |
| `CarouselArrows` | `clique` | `@12-apps/ui/data-display/Carousel` |
| `CarouselIndicators` | `escolhe` | `@12-apps/ui/data-display/Carousel` |
| `CarouselThumbnails` | `escolhe` | `@12-apps/ui/data-display/Carousel` |
| `CategoryField` | `escolhe` | `@12-apps/ui/form/total-form` |
| `CategorySelect` | `escolhe` | `@12-apps/ui/form/CategorySelect` |
| `CepField` | `preenche` | `@12-apps/ui/form/CepField` |
| `Checkbox` | `alterna` | `@12-apps/ui/form/Checkbox` |
| `CodeEditor` | `preenche` | `@12-apps/ui/form/CodeEditor` |
| `Collapsible` | `alterna` | `@12-apps/ui/layout/Collapsible` |
| `CollapsibleTrigger` | `alterna` | `@12-apps/ui/layout/Collapsible` |
| `ColumnsMenu` | `clique` | `@12-apps/ui/layout/ContentToolbar` |
| `Command` | `preenche` | `@12-apps/ui/form/Command` |
| `CommandGroup` | `escolhe` | `@12-apps/ui/form/Command` |
| `CommandInput` | `preenche` | `@12-apps/ui/form/Command` |
| `CommandList` | `escolhe` | `@12-apps/ui/form/Command` |
| `CommandPalette` | `preenche` | `@12-apps/ui/navigation/CommandPalette` |
| `ConfirmAction` | `clique` | `@12-apps/ui/feedback/ConfirmAction` |
| `ConfirmActionDialog` | `clique` | `@12-apps/ui/feedback/ConfirmAction` |
| `ConfirmButton` | `clique` | `@12-apps/ui/feedback/ConfirmAction` |
| `ContextMenu` | `clique` | `@12-apps/ui/navigation/ContextMenu` |
| `CreatableSelect` | `preenche` | `@12-apps/ui/form/CreatableSelect` |
| `DataGrid` | `clique/preenche` | `@12-apps/ui/data-display/DataGrid` |
| `DataViewsScopeTabs` | `escolhe` | `@12-apps/ui/data-display/DataViews` |
| `DateRangePicker` | `escolhe` | `@12-apps/ui/form/DateRangePicker` |
| `Dialog` | `clique` | `@12-apps/ui/feedback/Dialog` |
| `DialogHeader` | `clique` | `@12-apps/ui/feedback/Dialog` |
| `Drawer` | `clique` | `@12-apps/ui/layout/Drawer` |
| `DrawerHeader` | `clique` | `@12-apps/ui/layout/Drawer` |
| `DropdownMenu` | `clique` | `@12-apps/ui/navigation/DropdownMenu` |
| `FilterTrigger` | `clique` | `@12-apps/ui/layout/ContentToolbar` |
| `Form` | `clique/preenche` | `@12-apps/ui/form/Form` |
| `HeaderButton` | `clique` | `@12-apps/ui/form/HeaderButton` |
| `Input` | `preenche` | `@12-apps/ui/form/Input` |
| `InputOTP` | `preenche` | `@12-apps/ui/form/InputOTP` |
| `InstallPrompt` | `clique` | `@12-apps/ui/utility/InstallPrompt` |
| `Lightbox` | `clique` | `@12-apps/ui/data-display/Lightbox` |
| `Link` | `clique/preenche` | `@12-apps/ui/mui/Link` |
| `ListItemButton` | `clique/preenche` | `@12-apps/ui/mui/ListItemButton` |
| `Menubar` | `clique` | `@12-apps/ui/form/Menubar` |
| `MenubarGroup` | `clique` | `@12-apps/ui/form/Menubar` |
| `Modal` | `clique` | `@12-apps/ui/feedback/Modal` |
| `MultiSelectDropdown` | `escolhe` | `@12-apps/ui/layout/ContentToolbar` |
| `NavigationMenu` | `clique` | `@12-apps/ui/navigation/NavigationMenu` |
| `Pagination` | `escolhe` | `@12-apps/ui/navigation/Pagination` |
| `PasswordStrength` | `preenche` | `@12-apps/ui/form/PasswordStrength` |
| `PhoneInput` | `preenche` | `@12-apps/ui/form/PhoneInput` |
| `Popover` | `clique` | `@12-apps/ui/data-display/Popover` |
| `RadioGroup` | `escolhe` | `@12-apps/ui/form/RadioGroup` |
| `Resizable` | `clique/preenche` | `@12-apps/ui/layout/Resizable` |
| `RichTextEditor` | `preenche` | `@12-apps/ui/form/RichTextEditor` |
| `SavedViewsMenu` | `clique` | `@12-apps/ui/layout/ContentToolbar` |
| `SearchPalette` | `preenche` | `@12-apps/ui/form/SearchPalette` |
| `Select` | `escolhe` | `@12-apps/ui/form/Select` |
| `SelectField` | `escolhe` | `@12-apps/ui/form/total-form` |
| `SettingsSectionChips` | `escolhe` | `@12-apps/ui/layout/SettingsLayout` |
| `Sheet` | `clique` | `@12-apps/ui/data-display/Sheet` |
| `SheetHeader` | `clique` | `@12-apps/ui/data-display/Sheet` |
| `Sidebar` | `clique/preenche` | `@12-apps/ui/layout/Sidebar` |
| `Slider` | `escolhe` | `@12-apps/ui/form/Slider` |
| `SocialLoginButton` | `clique` | `@12-apps/ui/social-login-button` |
| `SortByDropdown` | `escolhe` | `@12-apps/ui/layout/ContentToolbar` |
| `StackedModal` | `clique` | `@12-apps/ui/feedback/StackedModal` |
| `Stepper` | `clique` | `@12-apps/ui/data-display/Stepper` |
| `SubmitButton` | `clique` | `@12-apps/ui/form/total-form` |
| `Switch` | `alterna` | `@12-apps/ui/form/Switch` |
| `TableFilter` | `escolhe` | `@12-apps/ui/layout/TableFilter` |
| `Tabs` | `escolhe` | `@12-apps/ui/navigation/Tabs` |
| `Textarea` | `preenche` | `@12-apps/ui/form/Textarea` |
| `TextField` | `preenche` | `@12-apps/ui/form/total-form` |
| `Toggle` | `alterna` | `@12-apps/ui/form/Toggle` |
| `ToggleGroup` | `escolhe` | `@12-apps/ui/form/ToggleGroup` |
| `TutorialOverlay` | `clique` | `@12-apps/ui/feedback/TutorialOverlay` |
| `UploadButton` | `clique` | `@12-apps/ui/form/UploadButton` |
| `UserMenu` | `clique` | `@12-apps/ui/user-avatar` |
| `ViewSelector` | `escolhe` | `@12-apps/ui/layout/ContentToolbar` |

## pode

| componente | passo | import |
|---|---|---|
| `Alert` | `—` | `@12-apps/ui/data-display/Alert` |
| `AnimatedIcon` | `—` | `@12-apps/ui/utility/AnimatedIcon` |
| `AppHeader` | `clique/preenche` | `@12-apps/ui/navigation/AppHeader` |
| `AppHeaderIdentity` | `clique` | `@12-apps/ui/navigation/AppHeader` |
| `Avatar` | `—` | `@12-apps/ui/data-display/Avatar` |
| `AvatarGroup` | `—` | `@12-apps/ui/data-display/Avatar` |
| `Badge` | `—` | `@12-apps/ui/data-display/Badge` |
| `Banner` | `—` | `@12-apps/ui/data-display/Banner` |
| `BaseCard` | `clique` | `@12-apps/ui/data-display/DataViews` |
| `BaseListCard` | `clique` | `@12-apps/ui/data-display/DataViews` |
| `Card` | `—` | `@12-apps/ui/layout/Card` |
| `CardGrid` | `—` | `@12-apps/ui/layout/CardGrid` |
| `Chart` | `—` | `@12-apps/ui/data-display/Chart` |
| `ChartLegend` | `clique` | `@12-apps/ui/data-display/Chart` |
| `Chip` | `clique` | `@12-apps/ui/data-display/Chip` |
| `Container` | `—` | `@12-apps/ui/layout/Container` |
| `ContentToolbar` | `clique/preenche` | `@12-apps/ui/layout/ContentToolbar` |
| `Dashboard` | `clique/preenche` | `@12-apps/ui/layout/Dashboard` |
| `DataViewsBoard` | `clique/preenche` | `@12-apps/ui/data-display/DataViews` |
| `DataViewsGrid` | `clique/preenche` | `@12-apps/ui/data-display/DataViews` |
| `DataViewsTableBase` | `clique/preenche` | `@12-apps/ui/data-display/DataViews` |
| `DescriptionItem` | `—` | `@12-apps/ui/data-display/DescriptionItem` |
| `EmptyState` | `—` | `@12-apps/ui/data-display/EmptyState` |
| `ErrorState` | `—` | `@12-apps/ui/data-display/ErrorState` |
| `FormErrorSnackbar` | `—` | `@12-apps/ui/form/total-form` |
| `FormField` | `clique/preenche` | `@12-apps/ui/form/Form` |
| `HoverCard` | `clique` | `@12-apps/ui/data-display/HoverCard` |
| `InfiniteScroll` | `clique/preenche` | `@12-apps/ui/utility/InfiniteScroll` |
| `InteractiveTooltip` | `clique` | `@12-apps/ui/data-display/InteractiveTooltip` |
| `LazyImage` | `—` | `@12-apps/ui/data-display/LazyImage` |
| `ListCardGroup` | `clique/preenche` | `@12-apps/ui/data-display/DataViews` |
| `ListItem` | `—` | `@12-apps/ui/mui/ListItem` |
| `MapPreview` | `clique/preenche` | `@12-apps/ui/data-display/MapPreview` |
| `Progress` | `—` | `@12-apps/ui/data-display/Progress` |
| `ScrollArea` | `—` | `@12-apps/ui/layout/ScrollArea` |
| `SectionOnboarding` | `clique` | `@12-apps/ui/data-display/SectionOnboarding` |
| `SettingsLayout` | `clique/preenche` | `@12-apps/ui/layout/SettingsLayout` |
| `SheetOverlay` | `clique` | `@12-apps/ui/data-display/Sheet` |
| `SonnerProvider` | `—` | `@12-apps/ui/feedback/Sonner` |
| `SpecChart` | `clique` | `@12-apps/ui/data-display/Chart` |
| `StatCard` | `—` | `@12-apps/ui/data-display/StatCard` |
| `Table` | `clique/preenche` | `@12-apps/ui/data-display/Table` |
| `Timeline` | `—` | `@12-apps/ui/data-display/Timeline` |
| `Toast` | `—` | `@12-apps/ui/feedback/Toast` |
| `ToastContainer` | `—` | `@12-apps/ui/feedback/Toast` |
| `Toaster` | `—` | `@12-apps/ui/feedback/Sonner` |
| `Tooltip` | `clique` | `@12-apps/ui/data-display/Tooltip` |
| `UserAvatar` | `clique` | `@12-apps/ui/user-avatar` |
| `VirtualGrid` | `clique/preenche` | `@12-apps/ui/utility/VirtualList` |
| `VirtualList` | `clique/preenche` | `@12-apps/ui/utility/VirtualList` |
| `WorkflowStep` | `clique` | `@12-apps/ui/utility/WorkflowStep` |

## nunca

| componente | import |
|---|---|
| `AccordionActions` | `@12-apps/ui/layout/Accordion` |
| `AccordionDetails` | `@12-apps/ui/layout/Accordion` |
| `AppBar` | `@12-apps/ui/mui/AppBar` |
| `AppHeaderBrand` | `@12-apps/ui/navigation/AppHeader` |
| `AppHeaderStatus` | `@12-apps/ui/navigation/AppHeader` |
| `AppleIcon` | `@12-apps/ui/social-login-button` |
| `AspectRatio` | `@12-apps/ui/utility/AspectRatio` |
| `AsyncStateContainer` | `@12-apps/ui/data-display/AsyncStateContainer` |
| `Blockquote` | `@12-apps/ui/typography/Blockquote` |
| `Box` | `@12-apps/ui/mui/Box` |
| `CardActions` | `@12-apps/ui/layout/Card` |
| `CardContent` | `@12-apps/ui/layout/Card` |
| `CardHeader` | `@12-apps/ui/layout/Card` |
| `CardMedia` | `@12-apps/ui/layout/Card` |
| `ChartContainer` | `@12-apps/ui/data-display/Chart` |
| `ChartLegendContent` | `@12-apps/ui/data-display/Chart` |
| `ChartSpecError` | `@12-apps/ui/data-display/Chart` |
| `ChartTooltip` | `@12-apps/ui/data-display/Chart` |
| `ChartTooltipContent` | `@12-apps/ui/data-display/Chart` |
| `Code` | `@12-apps/ui/typography/Code` |
| `CollapsibleContent` | `@12-apps/ui/layout/Collapsible` |
| `CommandEmpty` | `@12-apps/ui/form/Command` |
| `CommandLoading` | `@12-apps/ui/form/Command` |
| `CommandSeparator` | `@12-apps/ui/form/Command` |
| `CssBaseline` | `@12-apps/ui/mui/CssBaseline` |
| `DashboardContext` | `@12-apps/ui/layout/Dashboard` |
| `DialogActions` | `@12-apps/ui/feedback/Dialog` |
| `DialogContent` | `@12-apps/ui/feedback/Dialog` |
| `DragContainerProvider` | `@12-apps/ui/data-display/DataViews` |
| `DrawerContent` | `@12-apps/ui/layout/Drawer` |
| `DropIndicator` | `@12-apps/ui/data-display/DataViews` |
| `FacebookIcon` | `@12-apps/ui/social-login-button` |
| `Fields` | `@12-apps/ui/form/total-form` |
| `FormContainer` | `@12-apps/ui/form/total-form` |
| `FormContext` | `@12-apps/ui/form/total-form` |
| `FormControl` | `@12-apps/ui/mui/FormControl` |
| `FormControlLabel` | `@12-apps/ui/mui/FormControlLabel` |
| `FormLabel` | `@12-apps/ui/form/Form` |
| `FormMessage` | `@12-apps/ui/form/Form` |
| `GoogleIcon` | `@12-apps/ui/social-login-button` |
| `Grid2` | `@12-apps/ui/mui/Grid2` |
| `Heading` | `@12-apps/ui/typography/Heading` |
| `InputLabel` | `@12-apps/ui/mui/InputLabel` |
| `Label` | `@12-apps/ui/form/Label` |
| `List` | `@12-apps/ui/mui/List` |
| `ListItemText` | `@12-apps/ui/mui/ListItemText` |
| `LoadingState` | `@12-apps/ui/data-display/LoadingState` |
| `MenubarSeparator` | `@12-apps/ui/form/Menubar` |
| `ModalContent` | `@12-apps/ui/feedback/Modal` |
| `ModalStackProvider` | `@12-apps/ui/feedback/StackedModal` |
| `Paragraph` | `@12-apps/ui/typography/Paragraph` |
| `Portal` | `@12-apps/ui/utility/Portal` |
| `Separator` | `@12-apps/ui/layout/Separator` |
| `SettingsStatusMarker` | `@12-apps/ui/layout/SettingsLayout` |
| `SheetContent` | `@12-apps/ui/data-display/Sheet` |
| `SheetFooter` | `@12-apps/ui/data-display/Sheet` |
| `SidebarContent` | `@12-apps/ui/layout/Sidebar` |
| `SidebarFooter` | `@12-apps/ui/layout/Sidebar` |
| `SidebarHeader` | `@12-apps/ui/layout/Sidebar` |
| `Skeleton` | `@12-apps/ui/layout/Skeleton` |
| `SocialLoginContainer` | `@12-apps/ui/social-login-button` |
| `Spacer` | `@12-apps/ui/layout/Spacer` |
| `Stack` | `@12-apps/ui/mui/Stack` |
| `StackedModalActions` | `@12-apps/ui/feedback/StackedModal` |
| `StackedModalContent` | `@12-apps/ui/feedback/StackedModal` |
| `StackedModalProvider` | `@12-apps/ui/feedback/StackedModal` |
| `SvgIcon` | `@12-apps/ui/mui/SvgIcon` |
| `TableFilterContext` | `@12-apps/ui/layout/TableFilter` |
| `Text` | `@12-apps/ui/typography/Text` |
| `ThemeProvider` | `@12-apps/ui/mui/styles` |
| `TimingDiagram` | `@12-apps/ui/data-display/TimingDiagram` |
| `ToastProvider` | `@12-apps/ui/feedback/Toast` |
| `Toolbar` | `@12-apps/ui/mui/Toolbar` |
| `Transition` | `@12-apps/ui/utility/Transition` |
