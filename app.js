const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.get('/search', async(req, res) => {
  const keyword = req.query.keyword;

  if (!keyword) {
    return res.status(400).json({error: 'keyword is required'});
  }

  const browser = await puppeteer.launch({
      headless: true,         // indicates that we want the browser visible
      defaultViewport: false  // indicates not to use the default viewport size but to adjust to the user's screen resolution instead
      //userDataDir: './tmp'     // caches previous actions for the website. Useful for remembering if we've had to solve captchas in the past so we don't have to resolve them
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 414,
    height: 896
})

  try {
    await page.goto(`https://www.amazon.com/s?k=${keyword}`);
  } catch (err) {
    console.log('error while tyring to reach website');
    browser.close();
    res.status(500).json({ error: 'Internal server error' });
  }

  const laptops = await (await page.$$('.s-result-item')).slice(1, 5);

  let transformedLaptops = [];

  for (const laptop of laptops) {
    let title = null;
    let priceDollar = null;
    let priceCent = null
    let image = null;
    let url = null;
    let totalRating = null;
    let rating = null;
    let description = null;
    let top10Reviews = [];

    // for each element attempt to retrieve the title if there is one (some elements in here may not have a title)
    try {
      title = await page.evaluate(el => el.querySelector('h2 > a > span').textContent, laptop);
    } catch (err) {
      console.log('no title found for this element');
      console.log(err);
    }

    // for each element try to retrieve the price
    try {
      priceDollar = await page.evaluate(el => el.querySelector('span.a-price-whole').textContent, laptop);
      priceCent = await page.evaluate(el => el.querySelector('span.a-price-fraction').textContent, laptop);
    } catch(err) {
      console.log('no price found for this element');
    }

    // for each element try to retrieve the number of ratings
    try {
      totalRating = await page.evaluate(el => el.querySelector('span.a-size-base.s-underline-text').textContent,laptop);
    } catch(err) {
      console.log('no rating found for element');
    }

    // for each element try to retrieve the total rating
    try {
      rating = await page.evaluate(el => el.querySelector('span.a-icon-alt').textContent,laptop);
    } catch(err) {
      console.log('no rating found for element');
    }
    
    // for each element try to receive page URL
    try {
      url = await page.evaluate(el => el.querySelector('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal').href, laptop);
    } catch (err) {
      console.log('No URL found for this element');
    }

    if (title !== null) {
      transformedLaptops.push({
        title: title,
        price: `${priceDollar}${priceCent}`,
        imageUrl: image,
        pageUrl: url,
        noOfReviews: totalRating,
        rating: rating,
        top10Reviews: top10Reviews,
        description: description
      });
    }
  }
  //console.log(transformedLaptops);

  for (let lp of transformedLaptops) {
    let url = lp.pageUrl;
    let reviewUrl = null;
    try {
      await page.goto(url);
    } catch (err) {
      console.log('error while tyring to reach website');
      continue;
    }

    const element = await page.$('.a-container');
    
    // find description
    try {
      lp.description = await page.evaluate(el => el.querySelector('div > p > span').textContent, element);
    } catch (err) {
      lp.description = "description not found";
      continue;
    }
    if (lp.description === null) {
      lp.description = "description not found";
    }

    // get reviews page url
    try {
      reviewUrl = await page.evaluate(el => el.querySelector('.a-link-emphasis.a-text-bold').href, element);
    } catch (err) {
      console.log('not found review link')
    }

    if (reviewUrl !== null) {
      try {
        await page.goto(reviewUrl);
      } catch (err) {
        continue;
      }

      const reviews = await page.$$('.a-section.review.aok-relative');

      for (let r of reviews) {
        let reviewText = await page.evaluate(el => el.querySelector('span.a-size-base.review-text.review-text-content').textContent, r);
        lp.top10Reviews.push(reviewText);
      }
    }

    res.json(transformedLaptops);
  }

  await browser.close();
});

app.listen(PORT, ()=> {
  console.log(`server up at port : ${PORT}`);
});