<?php
/**
 * Theme setup and assets.
 */

function pbs_theme_setup(): void
{
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');

    register_nav_menus([
        'primary' => __('Primary Menu', 'painting-business-starter'),
    ]);
}
add_action('after_setup_theme', 'pbs_theme_setup');

function pbs_enqueue_assets(): void
{
    wp_enqueue_style('pbs-theme-style', get_stylesheet_uri(), [], '1.0.0');
}
add_action('wp_enqueue_scripts', 'pbs_enqueue_assets');

