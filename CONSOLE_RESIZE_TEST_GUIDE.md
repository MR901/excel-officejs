# Console Resize Functionality Test Guide

## Automated Testing

### 1. Run the Test Script
Open `taskpane.html` in Excel (or browser for development) and run the automated test:

```javascript
// In browser developer console:
testConsoleResize();  // Runs all automated tests
demoConsoleResize();  // Runs visual demonstration
```

### Expected Results:
- ✅ All 7 tests should pass
- Console should resize smoothly during demonstration
- No JavaScript errors in console

## Manual Testing

### 1. Visual Inspection
- [ ] Console should be visible at bottom of interface
- [ ] Drag handle (resizer) should be visible as a thin bar above console header
- [ ] Cursor should change to resize cursor (↕️) when hovering over drag handle

### 2. Mouse Drag Testing
1. **Hover Test**: Move mouse over the thin drag handle - cursor should change to `ns-resize`
2. **Drag Up**: Click and drag the handle upward - console should expand
3. **Drag Down**: Click and drag handle downward - console should shrink
4. **Minimum Height**: Try dragging down completely - should stop at minimum height (~28px)
5. **Maximum Height**: Drag up as far as possible - should stop at reasonable maximum

### 3. Constraint Testing
- [ ] Console should not shrink below header height (~28px)
- [ ] Console should not expand beyond 70% of window height
- [ ] Dragging should feel smooth without flickering
- [ ] Content should remain visible and scrollable while resizing

### 4. Edge Cases
- [ ] Try dragging very quickly - should not break
- [ ] Resize browser window - console should adapt properly
- [ ] Multiple rapid resize operations - should remain stable

## Touch Testing (Mobile/Tablet)

### If testing on touch device:
1. **Touch and Drag**: Use finger to drag the resize handle
2. **Smooth Operation**: Should work as smoothly as mouse interaction
3. **No Interference**: Should not interfere with page scrolling

## Troubleshooting

### If console resizing doesn't work:

1. **Check Elements Exist**:
   ```javascript
   console.log('Console element:', !!document.querySelector('.app-console'));
   console.log('Resizer element:', !!document.querySelector('.console-resizer'));
   ```

2. **Check CSS Variables**:
   ```javascript
   console.log('Console height:', getComputedStyle(document.documentElement).getPropertyValue('--console-height'));
   ```

3. **Check Module Loading**:
   ```javascript
   console.log('Console manager:', !!window.FogLAMP?.console);
   console.log('Global functions:', {
       setConsoleHeight: typeof window.setConsoleHeight,
       logMessage: typeof window.logMessage
   });
   ```

4. **Manual Height Test**:
   ```javascript
   // Try setting height manually
   if (window.setConsoleHeight) {
       window.setConsoleHeight(100);
   }
   ```

## Expected Behavior Summary

### ✅ Working Console Resize Should:
- Respond immediately to mouse/touch drag
- Maintain smooth visual feedback
- Respect minimum (28px) and maximum (70% viewport) constraints
- Preserve console content during resize
- Work on both desktop and mobile
- Not interfere with other UI elements

### ❌ Signs of Problems:
- No cursor change on hover
- Console doesn't resize when dragging
- Jumpy or flickering during resize
- Console disappears or becomes unusable
- JavaScript errors in browser console
- Resizing affects other UI elements

## CSS Verification

The following CSS should be present in `src/styles/taskpane.css`:

```css
.console-resizer { 
    height: 3px; 
    cursor: ns-resize; 
    background: #374151; 
    /* ... other styles ... */
}

.app-console { 
    flex: 0 0 var(--console-height, 28px); 
    /* ... other styles ... */
}
```

## Module Verification

The console resize functionality should be initialized by:
- `src/js/ui/console.js` - Contains the `ConsoleManager` class
- `src/js/main.js` - Initializes the console manager
- Event listeners should be attached during initialization

---

**Status**: ✅ Console resize functionality is properly implemented and should work correctly.
