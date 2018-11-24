const request = require('request-promise')
const cheerio = require('cheerio')
const url = 'https://www.bankmega.com/promolainnya.php'
const Promise = require("bluebird");
const chalk = require('chalk');
const categories = {}
const data = {
    "travel and entertainment": [],
    "lifestyle and wellness": [],
    "food and baverages": [],
    "gadget and electronics": [],
    "daily needs and home appliances": [],
    "others": []
}

const options = {
    uri: url,
    transform: (body) => {
        return cheerio.load(body);
    }
};

// Function random wait to prevent getting block by firewall
const wait = () => {
    ms = Math.floor(Math.random() * 1000) + 20
    console.log(chalk.blue(`Random waiting for ${ms} ms`))
    return new Promise((r, j) => setTimeout(r, ms))
}

/* Function to merge promo data and promo detail
@param category what category we will merge
@param detail aray of object that contain detail of promo in category
*/
const merge = (category, detail) => {
    console.log(chalk.blue("Proccessing data.........."))
    const promos = data[category].filter(value => {
        return value.href != undefined
    })

    promos.map(promo => {
        const haveEqualRef = (promoDetail) => promoDetail.href === promo.href
        const promoDetaiWithEqualRef = detail.find(haveEqualRef)
        delete promo.href
        delete promoDetaiWithEqualRef.href
        return Object.assign(promo, promoDetaiWithEqualRef)
    })
}

// Setup function for getting link for each sub category
const setup = () => {
    console.log(chalk.blue("Setting Up Scraper......"))
    return request(options)
        .then($ => {
            const _cat = []

            // Get Categories title
            $('#subcatpromo').find('div').each((i, el) => {
                _cat.push($(el).children().attr())
            })
            _cat.forEach(val => {
                
                // Here i use regex to get the link for each sub categories
                // Because hardcoding the link is not permitted
                // Other solution i think is to use headless browser like Puppeteer but its gonne take a loot of memory
                const re = new RegExp(`#${val.id}[^;]*`)
                const link = $('#contentpromolain2').find('script').html().match(re)[0].match(/load[^;]*/)[0].replace('load', "").replace(/[()"]/g, "")

                if(val.title === "Travel" ) categories["travel and entertainment"] = link
                else if(val.title === "Lifestyle") categories["lifestyle and wellness"] = link
                else if(val.title === "Food & Beverages") categories["food and baverages"] = link
                else if(val.title === "Gadget & Entertainment") categories["gadget and electronics"] = link
                else if(val.title === "Daily Needs") categories["daily needs and home appliances"] = link
                else if(val.title === "Others") categories["others"] = link
            })
        })
        .catch(err => {
            console.log(chalk.red("Something went wrong in setup function"))
        });
}

/* Function to fetc all promo by each category and each page */
const getPromo = async (category, page) => {
    await wait() // Random wait time
    options.uri = url.replace("promolainnya.php", categories[category])
    options.uri = `${options.uri}&page=${page}`

    console.log(chalk.green(`Scraping ${options.uri}`))
    const $ = await request(options).catch(e => console.log(chalk.red(`ERROR in ${options.uri}`)))

    let promos = []

    $('#promolain').find('li').each((i, el) => {
        const href = $(el).find('a').attr('href')
        const title = $(el).find('img').attr('title')
        const imageUrl = $(el).find('img').attr('src')

        const promo = {
            'href': href,
            'title': title,
            'imageUrl': url.replace("promolainnya.php", imageUrl)
        }

        promos.push(promo)
    })
    return promos
}


/* Function to fetch the promo detail from link ex: promo_detail.php?id=1231 */
const getPromoDetail = async (link) => {
    await wait() //Random wait time
    options.uri = url.replace("promolainnya.php", link)
    console.log(chalk.green(`Scraping ${options.uri}`))
    const $ = await request(options).catch(e => console.log(chalk.red(`ERROR in ${options.uri}`)))

    const image = $('.keteranganinside').find('img').attr('src')
    const areaPromo = $('.area').find('b').text()
    const periode = $('.periode').find('b').text()

    return {
        'href': link,
        'image': url.replace("promolainnya.php", image),
        'area promo': areaPromo,
        'periode': periode
    }
}

/* Function to fetch data by category */
const getData = async (category) => {
    // Get pagination, this will get how many page in that category
    options.uri = url.replace("promolainnya.php", categories[category])
    const pages = await request(options).then($ => {
        return $('.tablepaging').children('tbody').children('tr').children('td').length - 2
    })

    let promises = []

    for (let i = 1; i <= pages; i++) {
        promises.push({
            'category': category,
            'page': i
        })
    }

    return Promise.all(promises.map(v => {
        return getPromo(v.category, v.page)
    })).then(resp => {
        resp.forEach(body =>
            body.forEach(v => {
                data[category].push(v)
            })
        )
    })
}

/* Function to save data to solution.json */
const save = () => {
    const fs = require("fs");
    console.log(chalk.blue('Saving data to JSON.....'))
    fs.writeFile("./solution.json", JSON.stringify(data, null, 4), (err) => {
        if (err) {
            console.error(err);
            return;
        };
        console.log(chalk.green("File has been created"));
    });
}

/* This is the main function */
const run = async () => {
    const promoDetail = (promises, category) => {
        return Promise.all(promises.map(link => {
            return getPromoDetail(link)
        })).then(resp => {
            merge(category, resp)
        })
    }

    await setup()

    // Scraping travel category
    let promises = []

    await getData('travel and entertainment').then(() => {
        const travel = data["travel and entertainment"]
        // Getting promod deteil
        travel.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "travel and entertainment")

    // Scraping lifestyle and wellness
    promises = []
    await getData('lifestyle and wellness').then(() => {
        const lifestyle = data["lifestyle and wellness"]
        // Getting promo deteil
        lifestyle.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "lifestyle and wellness")

    // Scraping food and baverages
    promises = []
    await getData('Food & Beverages').then(() => {
        const lifestyle = data["food and baverages"]
        // Getting promo deteil
        lifestyle.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "food and baverages")

    // Scraping gadget and electronics
    promises = []
    await getData('gadget and electronics').then(() => {
        const lifestyle = data["gadget and electronics"]
        // Getting promo deteil
        lifestyle.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "gadget and electronics")

    // Scraping daily needs and home appliances
    promises = []
    await getData('daily needs and home appliances').then(() => {
        const lifestyle = data["daily needs and home appliances"]
        // Getting promo deteil
        lifestyle.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "daily needs and home appliances")

    // Scraping others
    promises = []
    await getData('others').then(() => {
        const lifestyle = data["others"]
        // Getting promo deteil
        lifestyle.forEach(value => {
            if (value.href.includes("promo_detail")) {
                promises.push(value.href)
            }
            else {
                delete value.href
            }
        })
    })

    // Scraping promo detail
    await promoDetail(promises, "others")

    await save()
}

run()