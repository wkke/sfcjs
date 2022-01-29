import { Context } from './core/context';
import { loadComponent, compileComponent } from './compiler';

Context.loadComponent = loadComponent;
Context.compileComponent = compileComponent;

export * from './core';
