<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap"
    rel="stylesheet"
  >
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header">
  <div class="site-wrap nav-row">
    <a href="<?php echo esc_url(home_url('/')); ?>" class="site-brand">
      <span class="brand-dot" aria-hidden="true"></span>
      <span><?php bloginfo('name'); ?></span>
    </a>

    <nav class="main-nav" aria-label="<?php esc_attr_e('Primary', 'painting-business-starter'); ?>">
      <?php
      if (has_nav_menu('primary')) {
          wp_nav_menu([
              'theme_location' => 'primary',
              'container' => false,
              'menu_class' => '',
              'fallback_cb' => false,
              'depth' => 1,
          ]);
      } else {
          echo '<ul>';
          echo '<li><a href="#services">Services</a></li>';
          echo '<li><a href="#work">Work</a></li>';
          echo '<li><a href="#pricing">Pricing</a></li>';
          echo '<li><a href="#contact">Contact</a></li>';
          echo '</ul>';
      }
      ?>
    </nav>

    <button class="menu-toggle" type="button" aria-label="<?php esc_attr_e('Menu', 'painting-business-starter'); ?>">☰</button>
  </div>
</header>

