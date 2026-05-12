<?php get_header(); ?>

<main class="section">
  <div class="site-wrap">
    <?php
    while (have_posts()) {
        the_post();
    ?>
      <article>
        <h1><?php the_title(); ?></h1>
        <div><?php the_content(); ?></div>
      </article>
    <?php
    }
    ?>
  </div>
</main>

<?php get_footer(); ?>
