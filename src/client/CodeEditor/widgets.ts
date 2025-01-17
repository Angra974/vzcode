import interact from '@replit/codemirror-interact';

import {
  ViewPlugin,
  Decoration,
  WidgetType,
} from '@codemirror/view';
import {
  Annotation,
  Extension,
  RangeSet,
} from '@codemirror/state';
import { EditorView } from 'codemirror';

// Interactive code widgets.
//  * Number dragger
//  * Boolean toggler
//  * URL clicker
//  * TODO color picker
// Inspired by:
// https://github.com/replit/codemirror-interact/blob/master/dev/index.ts
// `onInteract` is called when the user interacts with a widget.
export const widgets = ({
  onInteract,
}: {
  onInteract?: () => void;
}) =>
  interact({
    rules: [
      // hex color picker
      // Inspired by https://github.com/replit/codemirror-interact/blob/master/dev/index.ts#L71
      {
        regexp: /\"\#([0-9]|[A-F]|[a-f]){6}\"/g,
        cursor: 'pointer',
        onClick(text, setText, e) {
          const res =
            /\"(?<hex>\#([0-9]|[A-F]|[a-f]){6})\"/.exec(
              text,
            );
          const startingColor = res.groups?.hex;

          const sel = document.createElement('input');
          sel.type = 'color';

          sel.value = startingColor.toLowerCase();

          //valueIsUpper maintains style of user's code. It keeps the case of a-f the same case as the original."
          const valueIsUpper =
            startingColor.toUpperCase() === startingColor;

          const updateHex = (e: Event) => {
            const el = e.target as HTMLInputElement;

            if (el.value) {
              setText(
                `"${
                  valueIsUpper
                    ? el.value.toUpperCase()
                    : el.value
                }"`,
              );
            }
          };
          sel.addEventListener('input', updateHex);
          sel.click();
        },
      },

      // a rule for a number dragger
      {
        // the regexp matching the value
        regexp: /(?<!\#)-?\b\d+\.?\d*\b/g,
        // set cursor to "ew-resize" on hover
        cursor: 'ew-resize',
        // change number value based on mouse X movement on drag
        onDrag: (text, setText, e) => {
          if (onInteract) onInteract();
          const newVal = Number(text) + e.movementX;
          if (isNaN(newVal)) return;
          setText(newVal.toString());
        },
      },
      // bool toggler
      {
        regexp: /true|false/g,
        cursor: 'pointer',
        onClick: (text, setText) => {
          if (onInteract) onInteract();
          switch (text) {
            case 'true':
              return setText('false');
            case 'false':
              return setText('true');
          }
        },
      },
      // vec2 slider
      // Inspired by: https://github.com/replit/codemirror-interact/blob/master/dev/index.ts#L61
      {
        regexp:
          /vec2\(-?\b\d+\.?\d*\b\s*(,\s*-?\b\d+\.?\d*\b)?\)/g,
        cursor: 'move',

        onDrag: (text, setText, e) => {
          const res =
            /vec2\((?<x>-?\b\d+\.?\d*\b)\s*(,\s*(?<y>-?\b\d+\.?\d*\b))?\)/.exec(
              text,
            );
          const x = Number(res?.groups?.x);
          let y = Number(res?.groups?.y);
          if (isNaN(x)) return;
          if (isNaN(y)) y = x;
          setText(
            `vec2(${x + e.movementX}, ${y - e.movementY})`,
          );
        },
      },
      // rgb color picker
      // Inspired by https://github.com/replit/codemirror-interact/blob/master/dev/index.ts#L71
      //TODO: create color picker for hsl colors
      {
        regexp: /rgb\(.*\)/g,
        cursor: 'pointer',
        onClick: (text, setText, e) => {
          const res =
            /rgb\((?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)\)/.exec(
              text,
            );
          const r = Number(res?.groups?.r);
          const g = Number(res?.groups?.g);
          const b = Number(res?.groups?.b);

          //sel will open the color picker when sel.click is called.
          const sel = document.createElement('input');
          sel.type = 'color';

          if (!isNaN(r + g + b))
            sel.value = rgb2Hex(r, g, b);

          const updateRGB = (e: Event) => {
            const el = e.target as HTMLInputElement;
            if (el.value) {
              const [r, g, b] = hex2RGB(el.value);
              setText(`rgb(${r}, ${g}, ${b})`);
            }
            sel.removeEventListener('change', updateRGB);
          };

          sel.addEventListener('change', updateRGB);
          sel.click();
        },
      },
      // url clicker
      {
        regexp: /https?:\/\/[^ "]+/g,
        cursor: 'pointer',
        onClick: (text) => {
          window.open(text);
        },
      },

      //Set rotation to the angle between the x-axis and a line from the word "rotate" to the mouse pointer  (while dragging).
      //The rotation is in range (-180,180]
      {
        regexp: /rotate\(-?\d*\.?\d*\)/g,
        cursor: 'move',
        onDragStart(text, setText, e) {
          rotationOrigin = { x: e.screenX, y: e.screenY };
        },

        onDrag(text, setText, e) {
          if (rotationOrigin == null) return;
          //Calculate the angle between the x axis and a line from where the user first clicks to the current location of the mouse.
          setText(
            `rotate(${Math.round(
              (Math.atan2(
                rotationOrigin.y - e.screenY,
                e.screenX - rotationOrigin.x,
              ) *
                180) /
                Math.PI,
            )})`,
          );
        },
        onDragEnd(text, setText) {
          rotationOrigin = null;
        },
      },
    ],
  });

let rotationOrigin: { x: number; y: number } = null;

// Inspired by https://github.com/replit/codemirror-interact/blob/master/dev/index.ts#L108
const hex2RGB = (hex: string): [number, number, number] => {
  const v = parseInt(hex.substring(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

// Inspired by https://github.com/replit/codemirror-interact/blob/master/dev/index.ts#L117
const rgb2Hex = (r: number, g: number, b: number): string =>
  '#' + r.toString(16) + g.toString(16) + b.toString(16);

const colorCircleTheme = EditorView.baseTheme({
  '.color-circle-parent': { display: 'inline-block' },
});

const colorCircleAnnotation = Annotation.define();

export const colorsInTextPlugin: Extension = [
  ViewPlugin.fromClass(
    class {
      decorations: any;
      view: EditorView;
      constructor(view: EditorView) {
        this.decorations = RangeSet.of([]);
        this.view = view;
      }
    },
    {
      decorations: (v) => {
        const colorInfos = [];

        const lines = v.view.state.doc.iter();
        let line = lines.next();

        //Offset is the number of characters before the hex so the circle can be placed properly.
        let offset = 0;
        while (!line.done) {
          if (line.value === '\n') {
            offset++;
            line = lines.next();
            continue;
          }
          const hexColorOccurances = line.value.matchAll(
            /\"\#([0-9]|[A-F]|[a-f]){6}\"/g,
          );
          let hexOccurance = hexColorOccurances.next();
          while (!hexOccurance.done) {
            const offsetColorInfo = hexOccurance.value;
            offsetColorInfo.index += offset;
            colorInfos.push(offsetColorInfo);
            hexOccurance = hexColorOccurances.next();
          }
          offset += line.value.length;
          line = lines.next();
        }

        return Decoration.set(
          colorInfos.map((colorInfo) => {
            return {
              //9 is the length of the hex color string including quotation marks
              from: colorInfo.index + 9,
              to: colorInfo.index + 9,
              value: Decoration.widget({
                side: -1,
                widget: new ColorWidget(colorInfo[0]),
              }),
            };
          }),
        );
      },
    },
  ),
  colorCircleTheme,
];

class ColorWidget extends WidgetType {
  color: string;
  constructor(color: string) {
    super();
    this.color = color;
  }

  eq(widget: ColorWidget): boolean {
    // TODO consider possibly adding a random ID to support multiple instances with the same color
    return widget.color === this.color;
  }

  toDOM(view: EditorView): HTMLElement {
    const parent = document.createElement('div');

    parent.setAttribute('style', 'width:10px;height:10px');
    parent.className = 'color-circle-parent';
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    const colorCircle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    colorCircle.setAttributeNS(
      null,
      'fill',
      this.color.replace(/\"/g, ''),
    );
    colorCircle.setAttributeNS(null, 'r', '5');
    colorCircle.setAttributeNS(null, 'cx', '5');
    colorCircle.setAttributeNS(null, 'cy', '5');

    svg.setAttributeNS(null, 'viewBox', '0 0 10 10');
    svg.setAttributeNS(null, 'width', '10');
    svg.setAttributeNS(null, 'height', '10');

    svg.appendChild(colorCircle);

    parent.appendChild(svg);
    return parent;
  }
  ignoreEvent() {
    return false;
  }
}
