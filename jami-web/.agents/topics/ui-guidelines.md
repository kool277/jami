# UI - General Guidelines

- We use the Material UI library
- Components should always require human verification after creation or modification prior to submission
- Supplementary guidelines for a particular component can be found under client/ui-guidelines/*

## Creating

- The existing theme should be used in the design, avoid fixed values unless explicitely asked
- When initially creating a customized base component, uses examples provided by the Material UI documentation as as basis
- New components should follow accessibility guidelines, taking into account topics such as legibility and screen readers
- Take into account right-to-left languages. Icons that imply directionality should be flipped

## Modifiying

- Functionality of the component should not be broken, run tests post-modification
- Accessibility should not be broken
- Integration with right-to-left languages should be intact

## Text

- Ideally, an instance of text should be fully visible
- In the case that the text cannot fit in the given space, it should elide
- If the text is elided, copying it (if applicable) should always copy the full text as opposed to only what's visible
