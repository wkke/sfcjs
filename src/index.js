import { Context } from './core/context';
import { loadComponent, compileComponent } from './compiler';

Context.loadComponentCode = loadComponent;
Context.compileComponentCode = (src, text) => compileComponent(text, src);

export * from './core';
