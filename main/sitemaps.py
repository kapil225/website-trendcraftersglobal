from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticViewSitemap(Sitemap):
    priority = 0.7
    changefreq = 'weekly'

    def items(self):
        # list the view names for static/important pages
        return [
            'index',
            'about',
            'services',
            'work',
            'contact',
            'photo_shoot',
            'production',
            'digital_marketing',
            'brand_campaign',
            'web_development',
        ]

    def location(self, item):
        return reverse(item)
