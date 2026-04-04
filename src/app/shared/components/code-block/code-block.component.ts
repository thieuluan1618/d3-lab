import {
  Component,
  Input,
  OnChanges,
  ViewEncapsulation,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

@Component({
  selector: 'app-code-block',
  standalone: true,
  imports: [],
  templateUrl: './code-block.component.html',
  styleUrl: './code-block.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class CodeBlockComponent implements OnChanges, AfterViewInit {
  @Input() code = '';
  @Input() language = 'typescript';
  @Input() title = '';

  @ViewChild('codeEl', { static: true }) codeEl!: ElementRef<HTMLElement>;

  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.highlight();
  }

  ngOnChanges(): void {
    if (this.ready) {
      this.highlight();
    }
  }

  private highlight(): void {
    const result = hljs.highlight(this.code.trim(), { language: this.language });
    this.codeEl.nativeElement.innerHTML = result.value;
  }
}
